<template>
    <div class="p-4 pb-28 text-slate-100 min-h-screen bg-slate-900">
      <!-- En-tête -->
      <div class="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 class="text-2xl font-bold">Bons Plans & Macros</h1>
          <p class="text-xs text-slate-400 mt-0.5">
            Secteur : {{ activeSector }}
            <span v-if="lastUpdated"> • Mis à jour {{ lastUpdated }}</span>
          </p>
        </div>
        <button
          @click="generateInsights"
          :disabled="isGenerating"
          class="px-3.5 py-2 text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-95 disabled:opacity-50 rounded-xl shadow transition-opacity shrink-0"
        >
          {{ isGenerating ? '⏳ Analyse...' : '✨ Actualiser IA' }}
        </button>
      </div>
  
      <!-- Sous-navigation interne -->
      <div class="grid grid-cols-2 gap-2 p-1 bg-slate-800 border border-slate-700 rounded-xl mb-6">
        <button
          @click="activeSubTab = 'deals'"
          class="py-2 text-xs font-bold rounded-lg transition-colors"
          :class="activeSubTab === 'deals' ? 'bg-slate-900 text-blue-400 shadow' : 'text-slate-400'"
        >
          🎯 Bons Plans (3)
        </button>
        <button
          @click="activeSubTab = 'recipes'"
          class="py-2 text-xs font-bold rounded-lg transition-colors"
          :class="activeSubTab === 'recipes' ? 'bg-slate-900 text-emerald-400 shadow' : 'text-slate-400'"
        >
          🥗 Recettes Sèche (3)
        </button>
      </div>
  
      <!-- État vide -->
      <div
        v-if="!insights && !isGenerating"
        class="text-center py-12 px-4 bg-slate-800/50 border border-slate-800 rounded-2xl text-slate-400"
      >
        <p class="font-medium text-slate-200 mb-1">Aucune veille générée pour le moment</p>
        <p class="text-xs mb-4">
          Lance l'analyse IA pour croiser ton stock, ton panier et les promos du secteur.
        </p>
        <button
          @click="generateInsights"
          class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl"
        >
          ✨ Générer les Bons Plans & Recettes
        </button>
      </div>
  
      <!-- ONGLET 1 : BONS PLANS OPPORTUNISTES -->
      <div v-if="insights && activeSubTab === 'deals'" class="space-y-4">
        <!-- 1. Opportunité Alimentaire -->
        <div
          v-if="insights.opportunistic_deals?.food"
          class="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-2"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              🥩 Opportunité Protéines / Anti-Gaspi
            </span>
            <span class="text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-0.5 rounded-lg">
              {{ insights.opportunistic_deals.food.estimated_price }}
            </span>
          </div>
          <h2 class="text-base font-bold text-white">
            {{ insights.opportunistic_deals.food.title }}
          </h2>
          <p class="text-xs text-blue-300 font-medium">
            📍 {{ insights.opportunistic_deals.food.store }}
          </p>
          <p class="text-xs text-slate-300 leading-relaxed">
            {{ insights.opportunistic_deals.food.details }}
          </p>
        </div>
  
        <!-- 2. Opportunité Tech / Maison Action -->
        <div
          v-if="insights.opportunistic_deals?.tech_home"
          class="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-2"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-bold uppercase tracking-wider text-sky-400">
              🔌 Pépite Tech & Maison
            </span>
            <span class="text-xs font-bold bg-sky-950 text-sky-300 border border-sky-800 px-2.5 py-0.5 rounded-lg">
              {{ insights.opportunistic_deals.tech_home.estimated_price }}
            </span>
          </div>
          <h2 class="text-base font-bold text-white">
            {{ insights.opportunistic_deals.tech_home.title }}
          </h2>
          <p class="text-xs text-blue-300 font-medium">
            📍 {{ insights.opportunistic_deals.tech_home.store }}
          </p>
          <p class="text-xs text-slate-300 leading-relaxed">
            {{ insights.opportunistic_deals.tech_home.details }}
          </p>
        </div>
  
        <!-- 3. Veille Cafetière Barista à Grains -->
        <div
          v-if="insights.opportunistic_deals?.coffee_barista"
          class="bg-slate-800/80 border border-amber-700/60 rounded-2xl p-4 space-y-2.5"
        >
          <span class="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            ☕ Veille Machine Barista à Grains
          </span>
          <h2 class="text-base font-bold text-white">
            {{ insights.opportunistic_deals.coffee_barista.target_models }}
          </h2>
          <p class="text-xs text-slate-200 leading-relaxed">
            {{ insights.opportunistic_deals.coffee_barista.deal_watch }}
          </p>
          <div class="text-xs text-amber-200 bg-amber-950/50 border border-amber-800/70 p-2.5 rounded-xl">
            📊 <span class="font-semibold">Rentabilité :</span>
            {{ insights.opportunistic_deals.coffee_barista.roi_note }}
          </div>
        </div>
      </div>
  
      <!-- ONGLET 2 : RECETTES MACRO-FRIENDLY -->
      <div v-if="insights && activeSubTab === 'recipes'" class="space-y-4">
        <div
          v-for="recipe in recipeCards"
          :key="recipe.key"
          class="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-2.5"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-[11px] font-bold uppercase tracking-wider" :class="recipe.badgeColor">
              {{ recipe.tag }}
            </span>
            <span class="text-[11px] bg-slate-900 border border-slate-700 px-2.5 py-0.5 rounded-lg text-slate-300 font-medium">
              ⏱️ {{ recipe.data.prep_time }}
            </span>
          </div>
  
          <h2 class="text-base font-bold text-white">{{ recipe.data.title }}</h2>
  
          <div class="text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/70 px-2.5 py-1 rounded-lg inline-block">
            {{ recipe.data.macros }}
          </div>
  
          <div v-if="recipe.data.ingredients_used?.length" class="flex flex-wrap gap-1.5 pt-1">
            <span
              v-for="(ing, i) in recipe.data.ingredients_used"
              :key="i"
              class="text-[11px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700/80"
            >
              {{ ing }}
            </span>
          </div>
  
          <p class="text-xs text-slate-300 leading-relaxed pt-1">
            {{ recipe.data.steps }}
          </p>
        </div>
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
      {
        key: 'saturday',
        tag: '🍔 Repas Plaisir Samedi Soir',
        badgeColor: 'text-purple-400',
        data: r.saturday_dinner,
      },
      {
        key: 'breakfast',
        tag: '🥣 Petit-Déjeuner Express',
        badgeColor: 'text-blue-400',
        data: r.breakfast,
      },
      {
        key: 'snack',
        tag: '⚡ Goûter / Collation',
        badgeColor: 'text-emerald-400',
        data: r.snack,
      },
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
        alert('Erreur génération Bons Plans : ' + errMsg)
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
  
  onMounted(() => {
    fetchLatestInsights()
  })
  </script>