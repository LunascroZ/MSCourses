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

    let taste = "Mix";
    let vibe = "Gourmande";
    let count = 15;

    try {
      const body = await req.json();
      if (body?.taste) taste = String(body.taste);
      if (body?.vibe) vibe = String(body.vibe);
      if (body?.count) {
        const parsedCount = Number(body.count);
        if (Number.isFinite(parsedCount)) {
          count = Math.min(20, Math.max(5, Math.round(parsedCount)));
        }
      }
    } catch {
      // Valeurs par défaut si aucun body
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [inventoryRes, recipesRes] = await Promise.all([
      supabase.from("inventory").select("name, current_quantity, unit"),
      supabase.from("recipes").select("title, status").order("created_at", { ascending: false }).limit(150),
    ]);

    const stockList = (inventoryRes.data || [])
      .filter((i) => Number(i.current_quantity ?? 0) > 0)
      .map((i) => `${i.name} (${i.current_quantity} ${i.unit || "unité(s)"})`)
      .join(", ");

    const allRecipes = recipesRes.data || [];
    const likedTitles = allRecipes.filter((r) => r.status === "liked").map((r) => r.title);
    const dislikedTitles = allRecipes.filter((r) => r.status === "disliked").map((r) => r.title);
    const allExistingTitles = allRecipes.map((r) => r.title);

    const isCutMode = vibe.toLowerCase().includes("sèche");

    const systemInstruction = `Tu es le chef créatif de Matthew (MSCourses) pour un foyer de 2 personnes.

APPAREILS DISPONIBLES EN CUISINE :
- Airfryer 6L Moulinex
- BlendUp Moulinex (blender)
- Dolci Moulinex (machine à glaces / sorbets / desserts glacés)
- Four traditionnel
- Micro-ondes
- Plaque de cuisson
- Mixeur plongeur
Exploite intelligemment ces appareils selon les recettes (Airfryer pour le croustillant, Dolci pour les glaces/desserts sucrés, BlendUp pour smoothies/sauces/pâtes, etc.) et mentionne l'appareil dans les étapes quand c'est pertinent.

PHILOSOPHIE & CONTRAINTES :
- ${isCutMode ? "Objectif demandé : Recettes adaptées à la SÈCHE (riches en protéines, calories maîtrisées)." : "Objectif général : Recettes PLAISIR & WEEK-END variées et créatives (pas limitées à un régime de sèche)."}
- DÉCOUVERTE AVANT TOUT : Ne te limite SURTOUT PAS au stock actuel. Propose des plats variés, des cuisines du monde et de vraies découvertes. Tu peux utiliser quelques produits du stock en bonus, mais priorité absolue à l'envie demandée.
- EXCLUSION STRICTE : JAMAIS de beurre de cacahuète (peanut butter).
- MÉMOIRE : Inspire-toi du style des recettes LIKÉES, bannis le style des recettes DISLIKÉES, et ne répète JAMAIS un titre déjà proposé.
- FORMAT INGRÉDIENTS : Utilise des noms d'ingrédients simples et standards (ex: "Filet de poulet", "Oeuf", "Farine", "Lait demi-écrémé", "Riz Basmati") avec des quantités réalistes pour 2 personnes en g, kg, L, ml ou unité(s).

Réponds UNIQUEMENT en JSON valide respectant strictement le schéma demandé.`;

    const userPrompt = `DEMANDE ACTUELLE :
- Type : ${taste} (si "Salé" : 100% salé ; si "Sucré" : 100% sucré/desserts/glaces Dolci/goûters ; si "Mix" : mélange équilibré salé + sucré)
- Envie / Ambiance : ${vibe}
- Nombre exact de recettes à générer : ${count}

STOCK ACTUEL (à titre purement indicatif, ne te restreins pas à cette liste) :
${stockList || "Non renseigné"}

RECETTES LIKÉES :
${likedTitles.length ? likedTitles.join(" | ") : "Aucune encore"}

RECETTES DISLIKÉES (à éviter) :
${dislikedTitles.length ? dislikedTitles.join(" | ") : "Aucune encore"}

TITRES DÉJÀ PROPOSÉS (interdiction de répéter) :
${allExistingTitles.length ? allExistingTitles.join(" | ") : "Aucun"}

Génère exactement ${count} nouvelles recettes originales au format JSON :
{
  "recipes": [
    {
      "title": "Nom court et appétissant",
      "category": "${taste === "Sucré" ? "Sucré" : "Salé"} • ${vibe}",
      "prep_time": "ex: 20 min",
      "macros": "ex: ~650 kcal • 38g P",
      "ingredients": [
        { "name": "Ingrédient", "quantity": 200, "unit": "g" }
      ],
      "steps": "Étapes concises en 2 à 4 phrases (mentionne l'appareil utilisé si pertinent)."
    }
  ]
}`;

    const CANDIDATE_MODELS = [
      {
        name: "gemini-3.6-flash",
        timeoutMs: 38000,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 6000,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: "low" },
        },
      },
      {
        name: "gemini-3.8-flash",
        timeoutMs: 35000,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 6000,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: "low" },
        },
      },
    ];

    let geminiData: GeminiGenerateResponse | null = null;
    let firstDetailedError = "";

    for (const cfg of CANDIDATE_MODELS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${cfg.name}:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              generationConfig: cfg.generationConfig,
            }),
          }
        );

        if (res.ok) {
          geminiData = (await res.json()) as GeminiGenerateResponse;
          break;
        }

        const errText = await res.text();
        const formattedErr = `[${cfg.name} -> ${res.status}] ${errText}`;
        console.error(formattedErr);
        if (!firstDetailedError) firstDetailedError = formattedErr;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const formattedErr = `[${cfg.name} -> exception] ${msg}`;
        console.error(formattedErr);
        if (!firstDetailedError) firstDetailedError = formattedErr;
      } finally {
        clearTimeout(timer);
      }
    }

    if (!geminiData) {
      throw new Error(`Échec génération recettes : ${firstDetailedError}`);
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Réponse vide renvoyée par Gemini.");
    }

    const parsed = JSON.parse(rawText);
    const generated = Array.isArray(parsed?.recipes) ? parsed.recipes : [];

    if (generated.length === 0) {
      throw new Error("Aucune recette générée dans le JSON.");
    }

    const rowsToInsert = generated.map((r: any) => ({
      title: String(r.title || "Recette sans titre").trim(),
      category: String(r.category || `${taste} • ${vibe}`).trim(),
      prep_time: String(r.prep_time || "15 min").trim(),
      macros: String(r.macros || "").trim(),
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      steps: String(r.steps || "").trim(),
      status: "pending",
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("recipes")
      .insert(rowsToInsert)
      .select();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ recipes: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erreur generate-recipes:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});