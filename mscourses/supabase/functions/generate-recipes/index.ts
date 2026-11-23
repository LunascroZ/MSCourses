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
      // Valeurs par défaut
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
Exploite intelligemment ces appareils selon les recettes et indique toujours les températures, durées et préchauffages précis.

PHILOSOPHIE & CONTRAINTES :
- ${isCutMode ? "Objectif demandé : Recettes adaptées à la SÈCHE (riches en protéines, calories maîtrisées)." : "Objectif général : Recettes PLAISIR & WEEK-END variées et créatives (pas limitées à un régime de sèche)."}
- DÉCOUVERTE AVANT TOUT : Ne te limite SURTOUT PAS au stock actuel. Propose des plats variés, des cuisines du monde et de vraies découvertes.
- EXCLUSION STRICTE : JAMAIS de beurre de cacahuète (peanut butter).
- MÉMOIRE : Inspire-toi du style des recettes LIKÉES, bannis le style des recettes DISLIKÉES, et ne répète JAMAIS un titre déjà proposé.
- INGRÉDIENTS PRÉCIS : Utilise des noms simples pour la corrélation stock ("Filet de poulet", "Oeuf", "Farine", "Lait demi-écrémé", "Riz Basmati") ET ajoute un champ "note" utile dès que nécessaire (ex: "surgelées, incorporer encore gelées", "à décongeler au frigo", "frais", "coupé en dés", "température ambiante").
- ÉTAPES STRUCTURÉES : Découpe la préparation en 3 à 5 étapes claires avec durée, appareil/température si applicable, et instructions concrètes.

Réponds UNIQUEMENT en JSON valide respectant strictement le schéma demandé.`;

    const userPrompt = `DEMANDE ACTUELLE :
- Type : ${taste} (si "Salé" : 100% salé ; si "Sucré" : 100% sucré/desserts/glaces Dolci/goûters ; si "Mix" : mélange équilibré salé + sucré)
- Envie / Ambiance : ${vibe}
- Nombre exact de recettes à générer : ${count}

STOCK ACTUEL (indicatif uniquement, ne te limite pas à cette liste) :
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
      "prep_time": "ex: 25 min",
      "macros": "ex: ~620 kcal • 38g P",
      "summary": "Résumé appétissant en 1 à 2 phrases pour la carte Tinder.",
      "ingredients": [
        { "name": "Myrtilles", "quantity": 100, "unit": "g", "note": "surgelées, incorporer encore gelées" }
      ],
      "steps_detail": [
        {
          "title": "Préchauffage & Préparation",
          "duration": "5 min",
          "appliance": "Airfryer 180°C",
          "detail": "Préchauffe l'Airfryer à 180°C pendant 3 min. Coupe le poulet en dés réguliers et enrobe d'épices."
        }
      ]
    }
  ]
}`;

    const CANDIDATE_MODELS = [
      {
        name: "gemini-3.6-flash",
        timeoutMs: 42000,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: "low" },
        },
      },
      {
        name: "gemini-3.8-flash",
        timeoutMs: 38000,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 8192,
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

    const rowsToInsert = generated.map((r: any) => {
      const stepsDetail = Array.isArray(r.steps_detail) ? r.steps_detail : [];
      const fallbackStepsText = stepsDetail
        .map((s: any, idx: number) => `${idx + 1}. ${s.title ? `${s.title} : ` : ""}${s.detail || ""}`)
        .join("\n");

      return {
        title: String(r.title || "Recette sans titre").trim(),
        category: String(r.category || `${taste} • ${vibe}`).trim(),
        prep_time: String(r.prep_time || "15 min").trim(),
        macros: String(r.macros || "").trim(),
        summary: String(r.summary || "").trim(),
        ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
        steps_detail: stepsDetail,
        steps: String(r.steps || fallbackStepsText || r.summary || "").trim(),
        status: "pending",
      };
    });

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