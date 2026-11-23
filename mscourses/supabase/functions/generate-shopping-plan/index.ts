import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StorePriceRow {
  sector: string;
  store: string;
  search_term: string;
  product_name: string;
  price: number;
  unit_price: string | null;
  promo_label: string | null;
}

interface DraftRow {
  id: string;
  inventory_id: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  brand: string | null;
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface GeminiPlanItem {
  draft_name?: string;
  matched_product?: string;
  quantity?: number;
  unit?: string;
  unit_price_paid?: number;
  total_price?: number;
  price_reliability?: string;
  reason?: string;
  alternative_tip?: string | null;
}

interface GeminiPlanStore {
  store_name?: string;
  store_role?: string;
  store_subtotal?: number;
  items?: GeminiPlanItem[];
}

interface GeminiAlternativeRow {
  target_item?: string;
  alternative_product?: string;
  where_to_find?: string;
  estimated_price?: string;
  price_source?: string;
  benefit?: string;
}

interface GeminiArbitragePlan {
  sector?: string;
  summary?: string;
  logistics_arbitrage?: string;
  route_order?: string[];
  estimated_time?: string;
  total_estimated?: number;
  estimated_savings?: number;
  history_alerts?: string[];
  stores?: GeminiPlanStore[];
  alternatives_table?: GeminiAlternativeRow[];
}

const normalizeStoreName = (raw?: string): string => {
  const s = (raw || "").toLowerCase();
  if (s.includes("leclerc")) return "Leclerc";
  if (s.includes("carrefour")) return "Carrefour";
  if (s.includes("action")) return "Action";
  if (s.includes("lidl")) return "Lidl";
  if (s.includes("aldi")) return "Aldi";
  if (s.includes("grand frais")) return "Grand Frais";
  if (s.includes("auchan")) return "Auchan";
  if (s.includes("asia") || s.includes("paris store")) return "Asia";
  if (
    s.includes("ligne") ||
    s.includes("online") ||
    s.includes("prozis") ||
    s.includes("myprotein") ||
    s.includes("amazon")
  ) {
    return "En ligne";
  }
  return "Autre";
};

const normalizeKey = (s: string): string =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

    if (!geminiApiKey) {
      throw new Error("Variable d'environnement GEMINI_API_KEY manquante dans Supabase.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let bodySector: string | null = null;
    try {
      const body = await req.json();
      if (body?.sector) bodySector = String(body.sector);
    } catch {
      // Pas de body JSON fourni
    }

    const { data: configRows } = await supabase
      .from("app_config")
      .select("*")
      .limit(1);

    const activeSector =
      bodySector ||
      configRows?.[0]?.active_sector ||
      "Thionville/Terville";

    const [draftRes, inventoryRes, historyRes, pricesRes] = await Promise.all([
      supabase.from("draft_list").select("*").order("created_at", { ascending: true }),
      supabase.from("inventory").select("*"),
      supabase
        .from("purchase_history")
        .select("*")
        .order("purchase_date", { ascending: false })
        .limit(250),
      supabase
        .from("store_prices")
        .select("sector, store, search_term, product_name, price, unit_price, promo_label")
        .eq("sector", activeSector),
    ]);

    if (draftRes.error) throw draftRes.error;
    if (pricesRes.error) throw pricesRes.error;

    const draftItems = (draftRes.data || []) as DraftRow[];
    if (draftItems.length === 0) {
      return new Response(
        JSON.stringify({
          sector: activeSector,
          summary: "La liste brouillon est vide.",
          stores: [],
          alternatives_table: [],
          total_estimated: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inventoryItems = inventoryRes.data || [];
    const purchaseHistory = historyRes.data || [];
    const allPrices: StorePriceRow[] = pricesRes.data || [];

    // Agrégation de l'historique des prix réels : dernier prix payé par (produit + enseigne)
    const latestPriceMap = new Map<
      string,
      {
        name: string;
        store: string;
        price: number;
        quantity: number;
        unit: string;
        date: string;
      }
    >();

    for (const row of purchaseHistory) {
      const priceNum = Number(row.price ?? 0);
      if (priceNum <= 0 || !row.name) continue;
      const key = `${normalizeKey(row.name)}__${normalizeKey(row.store || "Autre")}`;
      if (!latestPriceMap.has(key)) {
        latestPriceMap.set(key, {
          name: row.name,
          store: row.store || "Autre",
          price: priceNum,
          quantity: Number(row.quantity ?? 1) || 1,
          unit: row.unit || "unité(s)",
          date: row.purchase_date ? String(row.purchase_date).slice(0, 10) : "récent",
        });
      }
    }

    const draftNamesNorm = draftItems.map((d) => normalizeKey(d.name));
    const matchedHistory: string[] = [];
    const otherHardDiscountHistory: string[] = [];

    for (const entry of latestPriceMap.values()) {
      const entryNorm = normalizeKey(entry.name);
      const line = `- ${entry.name} [${entry.store}] : ${entry.price.toFixed(2)}€ pour ${entry.quantity} ${entry.unit} (le ${entry.date})`;

      const isInDraft = draftNamesNorm.some(
        (dn) => dn.length >= 3 && (dn.includes(entryNorm) || entryNorm.includes(dn))
      );

      if (isInDraft) {
        matchedHistory.push(line);
      } else if (
        ["lidl", "action", "aldi", "grand frais", "asia"].some((st) =>
          normalizeKey(entry.store).includes(st)
        )
      ) {
        otherHardDiscountHistory.push(line);
      }
    }

    const realHistoryContext = [
      ...matchedHistory,
      ...otherHardDiscountHistory.slice(0, 40),
    ].join("\n");

    // Structuration compacte des prix Drive (filtrés sur le brouillon) vs Promos Anti-Crise
    const drivePricesByTerm: Record<string, StorePriceRow[]> = {};
    const cataloguePromos: StorePriceRow[] = [];

    const draftKeywords = draftItems
      .flatMap((d) => d.name.toLowerCase().split(/\s+/))
      .filter((w) => w.length >= 3)
      .map((w) => w.slice(0, 5));

    for (const row of allPrices) {
      if (row.search_term === "promo_catalogue") {
        const prodLower = row.product_name.toLowerCase();
        if (draftKeywords.some((kw) => prodLower.includes(kw))) {
          cataloguePromos.push(row);
        }
      } else {
        const termLower = row.search_term.toLowerCase();
        const matchesDraft = draftKeywords.some((kw) => termLower.includes(kw));
        if (matchesDraft || draftItems.length <= 3) {
          if (!drivePricesByTerm[termLower]) drivePricesByTerm[termLower] = [];
          drivePricesByTerm[termLower].push(row);
        }
      }
    }

    const formattedDriveContext = Object.entries(drivePricesByTerm)
      .map(([term, rows]) => {
        const leclerc = rows
          .filter((r) => r.store === "Leclerc")
          .sort((a, b) => a.price - b.price)
          .slice(0, 12)
          .map(
            (r) =>
              `  - [Leclerc] ${r.product_name} : ${r.price.toFixed(2)}€` +
              (r.unit_price ? ` (${r.unit_price})` : "") +
              (r.promo_label ? ` [${r.promo_label}]` : "")
          );

        const carrefour = rows
          .filter((r) => r.store === "Carrefour")
          .sort((a, b) => a.price - b.price)
          .slice(0, 12)
          .map((r) => {
            const netPrice = (r.price * 0.95).toFixed(2);
            return (
              `  - [Carrefour] ${r.product_name} : ${r.price.toFixed(2)}€ (soit ${netPrice}€ avec -5% fidélité)` +
              (r.unit_price ? ` (${r.unit_price})` : "") +
              (r.promo_label ? ` [${r.promo_label}]` : "")
            );
          });

        return `### Article recherché : "${term}"\n${[...leclerc, ...carrefour].join("\n")}`;
      })
      .join("\n\n");

    const formattedPromosContext =
      cataloguePromos.length > 0
        ? cataloguePromos
            .slice(0, 30)
            .map(
              (p) =>
                `- [${p.store}] ${p.product_name} -> ${p.price.toFixed(2)}€ (${p.promo_label || "Promo catalogue"})`
            )
            .join("\n")
        : "Aucune promo catalogue active pertinente pour cette liste.";

    const compactDrafts = draftItems.map((d) => ({
      name: d.name,
      quantity: d.quantity ?? 1,
      unit: d.unit || "unité(s)",
      brand: d.brand || undefined,
    }));

    const compactInventory = inventoryItems
      .filter((i) => (i.current_quantity ?? 0) > 0 || i.is_stock_item)
      .map((i) => ({
        name: i.name,
        stock: `${i.current_quantity ?? 0} ${i.unit || "unité(s)"}`,
        min: i.min_threshold ?? 0,
      }));

    const compactHistory = purchaseHistory.slice(0, 40).map((h) => ({
      name: h.name,
      qty: `${h.quantity ?? 1} ${h.unit || "unité(s)"}`,
      store: h.store,
      price: h.price,
      date: h.purchase_date ? String(h.purchase_date).slice(0, 10) : null,
    }));

    const systemInstruction = `Tu es un optimiseur expert de courses, de budget, d'arbitrage produit et de logistique du quotidien pour Matthew (MSCourses).

POINT D'ANCRAGE DU RUN :
- Secteur de référence : "${activeSector}" (centre de gravité de départ pour les tournées et distances).

PROFIL DU FOYER :
- 2 personnes en appartement / colocation : un étudiant ingénieur ICy (musculation / phase de sèche) + une jeune active en phase d'épargne.
- Objectif prioritaire : Maximisation stricte du ratio coût/bénéfice, respect du temps de trajet/carburant et optimisation des macros.
- Alimentation : Riche en protéines (volailles, bœuf haché 5%, œufs, skyr, thon) et glucides lents (riz basmati, avoine, patates douces, légumes). Batch cooking régulier.
- Formats privilégiés : Gros volumes, formats familiaux/XXL économiques.
- Avantage permanent fidélité : 5 % de remise immédiate permanente chez Carrefour (cumulable aux promotions).

PÉRIMÈTRES ET LIBERTÉ D'ARBITRAGE :
1. Si Ancrage = "Thionville/Terville" :
  - Cœur de base : E.Leclerc Terville, Action Terville (SuperGreen), Lidl Thionville, Aldi Terville, Carrefour Thionville.
  - Pépites & Spécialisés : Grand Frais Terville (fruits/légumes de saison, herbes), Asia Thionville (sacs de riz 5-10kg, sauces soja/sriracha grand format, nouilles, tofu).
2. Si Ancrage = "Saint-Amand/Valenciennes" :
  - Cœur de base : E.Leclerc Saint-Amand (Rocade), Lidl / Aldi Saint-Amand, Action Saint-Amand.
  - Grands pôles périphériques : Auchan Petite-Forêt ou Carrefour Aulnoy-lez-Valenciennes (avec le pôle Action Aulnoy/Petite-Forêt) SI une opportunité de volume, promo massive ou regroupement rentabilise le trajet.
  - Pépites & Spécialisés : Grand Frais Petite-Forêt / Valenciennes, Paris Store / épiceries spécialisées.

CONSIGNES D'ARBITRAGE, DE SUBSTITUTION ET DE LOGISTIQUE :
1. Hiérarchie de fiabilité des prix & fin du biais Drive :
  - Les PRIX RÉELS HISTORIQUES (HISTORIQUE DES PRIX RÉELS PAYÉS EN MAGASIN) et les PRIX DRIVE OFFICIELS sont à égalité en tant que sources fiables.
  - NE FAVORISE PLUS SYSTÉMATIQUEMENT LES DRIVES (Leclerc/Carrefour) : si un produit du brouillon a un prix réel récent moins cher chez Lidl, Aldi, Action, Grand Frais ou Asia dans l'historique, utilise ce prix réel pour arbitrer en sa faveur.
  - Renseigne "price_reliability" avec :
    * "Vérifié (Historique réel)" si tu t'appuies sur HISTORIQUE DES PRIX RÉELS PAYÉS EN MAGASIN,
    * "Prix Drive vérifié" si tu t'appuies sur PRIX DRIVE DU JOUR,
    * "Probable (arrivages / catalogue)" uniquement si le produit n'est dans aucune des deux bases.
2. Règle du détour rentable : Ne propose un détour vers une enseigne satellite (Lidl, Aldi, Action, Grand Frais, Asia, Carrefour périphérique...) que si le gain cumulé (au moins ~1,50 € ou regroupement de plusieurs articles / produits spécifiques) compense clairement le temps et le carburant. Justifie toujours ce choix.
3. Alternatives intelligentes & Substitutions ("alternatives_table" + "alternative_tip") :
  - Coût / Volume : Pour les grandes marques, propose l'équivalent MDD ou gros volume (ex: Chocoblast au lieu de Nutella, sacs de 5kg de riz).
  - Goût & Macros : Si un produit gagne à être remplacé par un équivalent plus noble, plus économique ou meilleur en macros sans exploser les calories, propose la substitution en l'expliquant.
  - Débouchés en ligne : Si un article est introuvable ou hors de prix en grande surface (sauces 0 kcal, compléments sportifs, gros sacs d'avoine), indique l'alternative en ligne.
4. Action : Référence absolue pour l'hygiène, la droguerie et l'entretien (sacs poubelle, lessive, etc.).
5. Source des prix dans "alternatives_table" :
  - Renseigne obligatoirement "price_source" avec l'une de ces 3 valeurs exactes : "Drive vérifié" (uniquement si présent dans PRIX DRIVE DU JOUR ou l'historique réel), "Catalogue promo" (uniquement si présent dans PROMOS CATALOGUES ANTI-CRISE), ou "Estimation IA" (Grand Frais, Action, Lidl, Aldi, Asia ou en ligne sans relevé exact).
6. Mémoire & Historique (3 semaines) : Signale dans "history_alerts" les produits non périssables déjà achetés récemment dans l'historique fourni.
7. Ordre de tournée : Respecte la chaîne du froid (sec / Action d'abord, frais / surgelés en dernier).
8. Quantité & Unité réelles (CRITIQUE) :
  - Pour tout produit alimentaire ou liquide ayant un poids/volume indiqué (ex: barquette 350g, filet 1kg, pack 6x1L), renseigne OBLIGATOIREMENT la quantité et l'unité réelles totales achetées (ex: "quantity": 350, "unit": "g" ou "quantity": 700, "unit": "g" si tu conseilles 2 barquettes ; "quantity": 6, "unit": "L"). Ne mets JAMAIS "1 unité(s)" si le produit a un poids ou un volume.
  - Utilise "unité(s)" uniquement pour les articles comptables sans poids/volume pertinent (ex: boîte de mouchoirs, œufs -> 12 unité(s), sacs poubelle -> 20 unité(s)).
  - Si tu conseilles plusieurs packs/barquettes pour couvrir le besoin du brouillon, indique-le dans "matched_product" (ex: "2x Viande hachée 5% MG Férial 350g") et calcule "total_price" en conséquence.

Ne génère PAS d'idées de recettes ni de veille électroménager/tech : concentre-toi uniquement sur le panier, l'arbitrage magasin par magasin, la tournée et le tableau des alternatives.
Réponds UNIQUEMENT en JSON valide respectant strictement le schéma demandé.`;

    const userPrompt = `SECTEUR : ${activeSector}
BESOINS (draft_list) : ${JSON.stringify(compactDrafts)}
STOCK ACTUEL (inventory) : ${JSON.stringify(compactInventory)}

HISTORIQUE DES PRIX RÉELS PAYÉS EN MAGASIN (Lidl, Action, Grand Frais, Aldi, Leclerc, etc.) :
${realHistoryContext || "Aucun historique de prix réel enregistré pour le moment."}

DERNIERS ACHATS CHRONOLOGIQUES (détection doublons 3 semaines) :
${JSON.stringify(compactHistory)}

PRIX DRIVE DU JOUR (Leclerc & Carrefour) :
${formattedDriveContext || "Aucun relevé Drive disponible."}

PROMOS CATALOGUES ANTI-CRISE :
${formattedPromosContext}

Format JSON strict attendu :
{
  "sector": "${activeSector}",
  "summary": "Résumé court du circuit et de l'économie globale",
  "logistics_arbitrage": "Explication claire : pourquoi telle enseigne (Lidl, Action, Carrefour, Leclerc, Grand Frais, Asia...) a été retenue ou écartée",
  "route_order": ["1. Action Terville (sec/droguerie)", "2. E.Leclerc Terville (frais)"],
  "estimated_time": "ex: ~40 min",
  "total_estimated": 0.00,
  "estimated_savings": 0.00,
  "history_alerts": ["Alerte si un non-périssable est déjà en stock ou acheté récemment"],
  "stores": [
    {
      "store_name": "Leclerc",
      "store_role": "Cœur de base • Frais & Drive",
      "store_subtotal": 0.00,
      "items": [
        {
          "draft_name": "Nom saisi dans draft_list",
          "matched_product": "Nom exact & format conseillé (ex: Viande hachée 5% MG Férial 350g)",
          "quantity": 350,
          "unit": "g",
          "unit_price_paid": 5.71,
          "total_price": 5.71,
          "price_reliability": "Vérifié (Historique réel) | Prix Drive vérifié | Probable (arrivages / catalogue)",
          "reason": "Justification précise : comparaison €/kg, historique réel Lidl/Action/Grand Frais, -5% Carrefour, proximité",
          "alternative_tip": "Substitution courte MDD / gros volume / macro (ou null)"
        }
      ]
    }
  ],
  "alternatives_table": [
    {
      "target_item": "Article de la liste concerné",
      "alternative_product": "Produit de remplacement / format XXL / MDD / en ligne",
      "where_to_find": "Enseigne ou site (ex: Lidl Thionville, Asia Thionville, Prozis)",
      "estimated_price": "ex: ~2.49 € / kg",
      "price_source": "Drive vérifié | Catalogue promo | Estimation IA",
      "benefit": "Gain financier, macro ou format (ex: -35% vs marque nationale, sac 5 kg)"
    }
  ]
}`;

    const CANDIDATE_MODELS = [
      { name: "gemini-3.6-flash", timeoutMs: 45000 },
      { name: "gemini-3.8-flash", timeoutMs: 45000 },
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
              systemInstruction: {
                parts: [{ text: systemInstruction }],
              },
              contents: [
                {
                  role: "user",
                  parts: [{ text: userPrompt }],
                },
              ],
              generationConfig: {
                temperature: 0.25,
                responseMimeType: "application/json",
                thinkingConfig: {
                  thinkingLevel: "low",
                },
              },
            }),
          }
        );

        if (res.ok) {
          geminiData = (await res.json()) as GeminiGenerateResponse;
          console.log(`Plan généré avec succès via ${cfg.name}`);
          break;
        }

        const errText = await res.text();
        const formattedErr = `[${cfg.name} -> ${res.status}] ${errText}`;
        console.warn(formattedErr);
        if (!firstDetailedError) firstDetailedError = formattedErr;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const formattedErr = `[${cfg.name} -> exception] ${msg}`;
        console.warn(formattedErr);
        if (!firstDetailedError) firstDetailedError = formattedErr;
      } finally {
        clearTimeout(timer);
      }
    }

    if (!geminiData) {
      throw new Error(`Tous les modèles Gemini ont échoué. Détail : ${firstDetailedError}`);
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Réponse vide renvoyée par Gemini.");
    }

    const parsedPlan = JSON.parse(rawText) as GeminiArbitragePlan;

    if (Array.isArray(parsedPlan.stores)) {
      const draftByName = new Map<string, DraftRow>();
      for (const d of draftItems) {
        if (d.name) draftByName.set(d.name.toLowerCase().trim(), d);
      }

      const shoppingRows = parsedPlan.stores.flatMap((st) =>
        (st.items || []).map((item) => {
          const matchedDraft = item.draft_name
            ? draftByName.get(item.draft_name.toLowerCase().trim())
            : undefined;

          const estPrice =
            Number(item.total_price ?? item.unit_price_paid ?? 0) || 0;

          return {
            inventory_id: matchedDraft?.inventory_id ?? null,
            name: item.matched_product || item.draft_name || "Article",
            quantity: Number(item.quantity ?? matchedDraft?.quantity ?? 1) || 1,
            unit: item.unit || matchedDraft?.unit || "unité(s)",
            store: normalizeStoreName(st.store_name),
            estimated_price: estPrice,
            actual_price: null,
            is_checked: false,
            reason: item.reason || null,
            alternative_tip: item.alternative_tip || null,
            price_reliability: item.price_reliability || null,
          };
        })
      );

      if (shoppingRows.length > 0) {
        const { error: delErr } = await supabase
          .from("shopping_list")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");

        if (delErr) throw new Error(`Erreur nettoyage shopping_list : ${delErr.message}`);

        const { error: insErr } = await supabase
          .from("shopping_list")
          .insert(shoppingRows);

        if (insErr) throw new Error(`Erreur insertion shopping_list : ${insErr.message}`);
      }
    }

    try {
      await supabase.from("shopping_briefs").insert({
        sector: activeSector,
        brief_json: parsedPlan,
      });
    } catch {
      // Non bloquant
    }

    return new Response(JSON.stringify(parsedPlan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erreur generate-shopping-plan:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});