<template>
    <div class="bonus-page">
      <div class="page-head">
        <div>
          <h2>Bons Plans & Macros</h2>
          <span v-if="lastUpdated" class="sub-meta">Mis à jour {{ lastUpdated }}</span>
        </div>
        <button
          type="button"
          class="ai-btn"
          :disabled="isGenerating"
          @click="generateInsights"
        >
          {{ isGenerating ? '⏳ Analyse...' : '✨ Actualiser IA' }}
        </button>
      </div>
  
      <!-- Segmented control interne -->
      <div class="segmented">
        <button
          type="button"
          class="seg-btn"
          :class="{ active: activeSubTab === 'deals' }"
          @click="activeSubTab = 'deals'"
        >
          🎯 Bons Plans
        </button>
        <button
          type="button"
          class="seg-btn"
          :class="{ active: activeSubTab === 'recipes' }"
          @click="activeSubTab = 'recipes'"
        >
          🥗 Recettes Sèche
        </button>
      </div>
  
      <div v-if="!insights && !isGenerating" class="ms-card empty-card">
        <p class="empty-title">Aucune veille générée</p>
        <p class="empty-sub">Lance l'analyse IA pour croiser ton stock, ton panier et le secteur.</p>
        <button type="button" class="ai-btn mt-btn" @click="generateInsights">
          ✨ Générer maintenant
        </button>
      </div>
  
      <!-- BONS PLANS -->
      <div v-if="insights && activeSubTab === 'deals'" class="cards-stack">
        <section v-if="insights.opportunistic_deals?.food" class="ms-card deal-card accent-green">
          <div class="deal-top">
            <span class="deal-tag green">🥩 Protéines & Anti-Gaspi</span>
            <span class="price-pill">{{ insights.opportunistic_deals.food.estimated_price }}</span>
          </div>
          <h3>{{ insights.opportunistic_deals.food.title }}</h3>
          <p class="store-line">📍 {{ insights.opportunistic_deals.food.store }}</p>
          <p class="deal-desc">{{ insights.opportunistic_deals.food.details }}</p>
        </section>
  
        <section v-if="insights.opportunistic_deals?.tech_home" class="ms-card deal-card accent-blue">
          <div class="deal-top">
            <span class="deal-tag blue">🔌 Pépite Tech & Maison</span>
            <span class="price-pill">{{ insights.opportunistic_deals.tech_home.estimated_price }}</span>
          </div>
          <h3>{{ insights.opportunistic_deals.tech_home.title }}</h3>
          <p class="store-line">📍 {{ insights.opportunistic_deals.tech_home.store }}</p>
          <p class="deal-desc">{{ insights.opportunistic_deals.tech_home.details }}</p>
        </section>
  
        <section v-if="insights.opportunistic_deals?.coffee_barista" class="ms-card deal-card accent-amber">
          <span class="deal-tag amber">☕ Veille Cafetière à Grains</span>
          <h3>{{ insights.opportunistic_deals.coffee_barista.target_models }}</h3>
          <p class="deal-desc">{{ insights.opportunistic_deals.coffee_barista.deal_watch }}</p>
          <div class="roi-box">
            📊 <strong>Rentabilité :</strong> {{ insights.opportunistic_deals.coffee_barista.roi_note }}
          </div>
        </section>
      </div>
  
      <!-- RECETTES -->
      <div v-if="insights && activeSubTab === 'recipes'" class="cards-stack">
        <section v-for="recipe in recipeCards" :key="recipe.key" class="ms-card deal-card">
          <div class="deal-top">
            <span class="deal-tag" :class="recipe.color">{{ recipe.tag }}</span>
            <span class="time-pill">⏱️ {{ recipe.data.prep_time }}</span>
          </div>
          <h3>{{ recipe.data.title }}</h3>
          <div class="macro-pill">{{ recipe.data.macros }}</div>
  
          <div v-if="recipe.data.ingredients_used?.length" class="ing-list">
            <span v-for="(ing, i) in recipe.data.ingredients_used" :key="i" class="ing-chip">
              {{ ing }}
            </span>
          </div>
  
          <p class="deal-desc">{{ recipe.data.steps }}</p>
        </section>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted } from 'vue'
  import { supabase } from '../supabase'
  import { useSector } from '../composables/useSector'
  
  const { activeSector } = useSector()
  const insights = ref(null)
  const lastUpdated = ref('')
  const isGenerating = ref(false)
  const activeSubTab = ref('deals')
  
  const recipeCards = computed(() => {
    const r = insights.value?.macro_recipes
    if (!r) return []
    return [
      { key: 'saturday', tag: '🍔 Plaisir Samedi Soir', color: 'purple', data: r.saturday_dinner },
      { key: 'breakfast', tag: '🥣 Petit-Déjeuner Express', color: 'blue', data: r.breakfast },
      { key: 'snack', tag: '⚡ Collation Sèche', color: 'green', data: r.snack },
    ].filter(card => Boolean(card.data))
  })
  
  const fetchLatestInsights = async () => {
    const { data, error } = await supabase
      .from('bonus_insights')
      .select('insights_json, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
  
    if (!error && data && data.length > 0) {
      insights.value = data[0].insights_json
      lastUpdated.value = new Date(data[0].created_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }
  
  const generateInsights = async () => {
    if (isGenerating.value) return
    isGenerating.value = true
  
    try {
      const { data, error } = await supabase.functions.invoke('generate-bonus-insights', {
        body: { sector: activeSector.value },
      })
  
      if (error) {
        let errMsg = error.message
        try {
          const bodyText = await error.context?.text()
          if (bodyText) errMsg = JSON.parse(bodyText).error || bodyText
        } catch {
          // Fallback
        }
        alert('Erreur Bons Plans : ' + errMsg)
        return
      }
  
      if (data) {
        insights.value = data
        lastUpdated.value = "à l'instant"
      }
    } finally {
      isGenerating.value = false
    }
  }
  
  onMounted(fetchLatestInsights)
  </script>
  
  <style scoped>
  .bonus-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  
  .page-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  
  .page-head h2 {
    font-size: 1.2rem;
    font-weight: 800;
  }
  
  .sub-meta {
    display: block;
    font-size: 0.72rem;
    color: var(--text-light);
    margin-top: 2px;
  }
  
  .ai-btn {
    padding: 8px 14px;
    border-radius: 12px;
    border: none;
    background: var(--cta-gradient);
    color: #ffffff;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
  }
  
  .ai-btn:disabled { opacity: 0.5; }
  
  .segmented {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    padding: 5px;
    background-color: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    box-shadow: var(--shadow);
  }
  
  .seg-btn {
    height: 38px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--text-light);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
  }
  
  .seg-btn.active {
    background-color: var(--primary);
    color: #ffffff;
  }
  
  .cards-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .ms-card {
    background-color: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    box-shadow: var(--shadow);
  }
  
  .deal-card {
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-left: 4px solid var(--primary);
  }
  
  .deal-card.accent-green { border-left-color: var(--success); }
  .deal-card.accent-blue { border-left-color: #3b82f6; }
  .deal-card.accent-amber { border-left-color: var(--warning); }
  
  .deal-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  
  .deal-tag {
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  
  .deal-tag.green { color: var(--success); }
  .deal-tag.blue { color: #3b82f6; }
  .deal-tag.amber { color: var(--warning); }
  .deal-tag.purple { color: #9333ea; }
  
  .price-pill,
  .time-pill {
    font-size: 0.74rem;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 8px;
    background-color: var(--input-bg);
    border: 1px solid var(--border-color);
  }
  
  .deal-card h3 {
    font-size: 1rem;
    font-weight: 800;
    line-height: 1.3;
  }
  
  .store-line {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--primary);
  }
  
  .deal-desc {
    font-size: 0.82rem;
    line-height: 1.48;
    color: var(--text-light);
  }
  
  .roi-box {
    font-size: 0.78rem;
    line-height: 1.4;
    padding: 10px 12px;
    border-radius: 10px;
    background-color: rgba(245, 158, 11, 0.14);
    color: var(--text-main);
  }
  
  .macro-pill {
    align-self: flex-start;
    font-size: 0.76rem;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 8px;
    background-color: rgba(16, 185, 129, 0.14);
    color: var(--success);
  }
  
  .ing-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .ing-chip {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 6px;
    background-color: var(--input-bg);
    border: 1px solid var(--border-color);
  }
  
  .empty-card {
    text-align: center;
    padding: 32px 16px;
  }
  
  .empty-title {
    font-weight: 700;
    margin-bottom: 4px;
  }
  
  .empty-sub {
    font-size: 0.8rem;
    color: var(--text-light);
  }
  
  .mt-btn {
    margin-top: 14px;
  }
  </style>