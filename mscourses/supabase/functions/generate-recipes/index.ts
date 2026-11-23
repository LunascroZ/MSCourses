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

    const [inventoryRes, recipesRes] = await Promise.all([
      supabase.from("inventory").select("name, current_quantity, unit"),
      supabase.from("recipes").select("title, status").order("created_at", { ascending: false }).limit(120),
    ]);

    const stockList = (inventoryRes.data || [])
      .filter((i) => Number(i.current_quantity ?? 0) > 0)
      .map((i) => `${i.name} (${i.current_quantity} ${i.unit || "unité(s)"})`)
      .join(", ");

    const allRecipes = recipesRes.data || [];
    const likedTitles = allRecipes.filter((r) => r.status === "liked").map((r) => r.title);
    const dislikedTitles = allRecipes.filter((r) => r.status === "disliked").map((r) => r.title);
    const allExistingTitles = allRecipes.map((r) => r.title);

    const systemInstruction = `Tu es le chef nutritionniste de Matthew (MSCourses).
PROFIL :
- Foyer : 2 personnes, musculation / sèche, alimentation riche en protéines (poulet, bœuf haché 5%, œufs, skyr, thon, tofu), glucides maîtrisés (riz basmati, patate douce, pâtes, avoine).
- EXCLUSION STRICTE : JAMAIS de beurre de cacahuète (peanut butter).
- DIVERSITÉ : Propose des recettes variées (plats batch cooking, repas plaisir samedi soir macro-friendly, petits-déjeuners, collations).
- MÉMOIRE : Inspire-toi du style des recettes LIKÉES, évite absolument le style des recettes DISLIKÉES, et ne propose JAMAIS un titre déjà existant.
- CORRÉLATION STOCK : Pour les ingrédients courants présents dans le stock fourni, réutilise autant que possible les mêmes noms simples (ex: "Filet de poulet", "Riz Basmati", "Boeuf hachée 5 %", "Oeuf", "Skyr") avec des quantités réalistes en g, kg, L, ml ou unité(s).

Réponds UNIQUEMENT en JSON valide respectant strictement le schéma demandé.`;

    const userPrompt = `STOCK ACTUEL DISPONIBLE :
${stockList || "Stock vide"}

RECETTES LIKÉES (à privilégier dans le style) :
${likedTitles.length ? likedTitles.join(" | ") : "Aucune encore"}

RECETTES DISLIKÉES (à éviter absolument) :
${dislikedTitles.length ? dislikedTitles.join(" | ") : "Aucune encore"}

TITRES DÉJÀ PROPOSÉS (interdiction de répéter) :
${allExistingTitles.length ? allExistingTitles.join(" | ") : "Aucun"}

Génère exactement 5 nouvelles recettes originales au format JSON :
{
  "recipes": [
    {
      "title": "Nom court et appétissant de la recette",
      "category": "Plat | Plaisir | Petit-déj | Collation",
      "prep_time": "ex: 20 min",
      "macros": "ex: ~580 kcal • 52g P • 60g G • 12g L",
      "ingredients": [
        { "name": "Filet de poulet", "quantity": 300, "unit": "g" },
        { "name": "Riz Basmati", "quantity": 150, "unit": "g" }
      ],
      "steps": "Étapes claires et concises en 3 à 5 phrases."
    }
  ]
}`;

    const CANDIDATE_MODELS = [
      {
        name: "gemini-3.6-flash",
        timeoutMs: 22000,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2200,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: "low" },
        },
      },
      {
        name: "gemini-3.8-flash",
        timeoutMs: 20000,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2200,
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
      category: String(r.category || "Plat").trim(),
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