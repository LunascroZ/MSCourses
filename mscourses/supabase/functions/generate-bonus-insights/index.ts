import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

    if (!geminiApiKey) {
      throw new Error("Variable d'environnement GEMINI_API_KEY manquante.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let bodySector: string | null = null;
    try {
      const body = await req.json();
      if (body?.sector) bodySector = String(body.sector);
    } catch {
      // Pas de body JSON
    }

    const { data: configRows } = await supabase
      .from("app_config")
      .select("*")
      .limit(1);

    const activeSector =
      bodySector ||
      configRows?.[0]?.active_sector ||
      "Thionville/Terville";

    const [inventoryRes, shoppingRes, promosRes] = await Promise.all([
      supabase.from("inventory").select("name, current_quantity, unit"),
      supabase.from("shopping_list").select("name, quantity, unit, store"),
      supabase
        .from("store_prices")
        .select("store, product_name, price, promo_label")
        .eq("sector", activeSector)
        .eq("search_term", "promo_catalogue")
        .limit(40),
    ]);

    const stockContext = (inventoryRes.data || [])
      .filter((i) => (i.current_quantity ?? 0) > 0)
      .map((i) => `${i.name} (${i.current_quantity} ${i.unit || "unité(s)"})`)
      .join(", ");

    const basketContext = (shoppingRes.data || [])
      .map((s) => `${s.name} [${s.store}] (${s.quantity} ${s.unit || "unité(s)"})`)
      .join(", ");

    const promosContext = (promosRes.data || [])
      .map((p) => `[${p.store}] ${p.product_name} : ${p.price.toFixed(2)}€ (${p.promo_label || "Promo"})`)
      .join("\n");

    const systemInstruction = `Tu es le conseiller lifestyle, nutrition sportive et bons plans de Matthew (MSCourses).

PROFIL & CONTRAINTES :
- Secteur actif : "${activeSector}".
- Foyer : 2 personnes (étudiant ingénieur ICy en phase de sèche / musculation + jeune active).
- Alimentation : Riche en protéines (poulet, bœuf haché 5%, œufs, skyr, thon, whey), glucides lents (riz basmati, avoine, patates douces, pâtes complètes). Batch cooking régulier.
- EXCLUSION STRICTE : Ne jamais utiliser de beurre de cacahuète (peanut butter) dans les recettes.
- Équipement cible café : Veille sur les machines espresso semi-automatiques avec broyeur intégré (Ninja Luxe Café Premier ES601EU, De'Longhi La Specialista Arte, Philips Barista Brew) en promo flash ou reconditionné, avec calcul de rentabilité grain vs dosettes Senseo/capsules.

Réponds UNIQUEMENT en JSON valide respectant strictement le schéma demandé.`;

    const userPrompt = `SECTEUR : ${activeSector}
STOCK DISPONIBLE (inventory) : ${stockContext || "Non renseigné"}
PANIER EN RAYON (shopping_list) : ${basketContext || "Vide"}
PROMOS CATALOGUES ACTIVES :
${promosContext || "Aucune promo catalogue chargée."}

Génère le JSON suivant :
{
  "sector": "${activeSector}",
  "opportunistic_deals": {
    "food": {
      "title": "Titre court de l'opportunité alimentaire",
      "store": "Enseigne du secteur",
      "estimated_price": "ex: ~7.99 € / kg",
      "details": "Opportunité viande/protéines format familial ou astuce bac anti-gaspi adaptée aux macros"
    },
    "tech_home": {
      "title": "Accessoire Tech / Maison malin",
      "store": "Action (${activeSector.includes("Thionville") ? "Terville SuperGreen" : "Saint-Amand / Aulnoy"})",
      "estimated_price": "ex: ~4.99 €",
      "details": "Accessoire utile quotidien étudiant/bureau (câbles USB-C 100W PD, rangement batch cooking, etc.)"
    },
    "coffee_barista": {
      "target_models": "Ninja Luxe Café ES601EU • De'Longhi La Specialista Arte",
      "deal_watch": "Conseil d'achat / cible prix promo ou reconditionné du moment",
      "roi_note": "Rappel chiffré de rentabilité du café en grain (~0,12 €/tasse) face aux dosettes/capsules (~0,35-0,45 €/tasse)"
    }
  },
  "macro_recipes": {
    "saturday_dinner": {
      "title": "Nom du repas plaisir Samedi Soir (compatible sèche)",
      "macros": "ex: ~620 kcal • 58g P • 65g G • 12g L",
      "prep_time": "ex: 25 min",
      "ingredients_used": ["Ingrédient 1", "Ingrédient 2"],
      "steps": "Préparation rapide et gourmande en 3-4 lignes"
    },
    "breakfast": {
      "title": "Petit-déjeuner protéiné rapide",
      "macros": "ex: ~450 kcal • 40g P • 48g G • 9g L",
      "prep_time": "ex: 5 min",
      "ingredients_used": ["Ingrédient 1", "Ingrédient 2"],
      "steps": "Préparation express transportable"
    },
    "snack": {
      "title": "Goûter / Collation sèche",
      "macros": "ex: ~280 kcal • 32g P • 24g G • 5g L",
      "prep_time": "ex: 3 min",
      "ingredients_used": ["Ingrédient 1", "Ingrédient 2"],
      "steps": "Préparation rapide sans beurre de cacahuète"
    }
  }
}`;

    const CANDIDATE_MODELS = [
      { name: "gemini-3.6-flash", timeoutMs: 45000 },
      { name: "gemini-3.8-flash", timeoutMs: 45000 },
    ];

    let geminiData: GeminiGenerateResponse | null = null;
    let firstDetailedError = "";

    for (const cfg of CANDIDATE_MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${cfg.name}:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(cfg.timeoutMs),
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              generationConfig: {
                temperature: 0.4,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingLevel: "low" },
              },
            }),
          }
        );

        if (res.ok) {
          geminiData = (await res.json()) as GeminiGenerateResponse;
          break;
        }

        const errText = await res.text();
        const formattedErr = `[${cfg.name} -> ${res.status}] ${errText}`;
        if (!firstDetailedError) firstDetailedError = formattedErr;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const formattedErr = `[${cfg.name} -> exception] ${msg}`;
        if (!firstDetailedError) firstDetailedError = formattedErr;
      }
    }

    if (!geminiData) {
      throw new Error(`Échec génération bons plans : ${firstDetailedError}`);
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Réponse vide renvoyée par Gemini.");
    }

    const parsedInsights = JSON.parse(rawText);

    await supabase.from("bonus_insights").insert({
      sector: activeSector,
      insights_json: parsedInsights,
    });

    return new Response(JSON.stringify(parsedInsights), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erreur generate-bonus-insights:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});