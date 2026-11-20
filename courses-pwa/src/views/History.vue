<template>
    <div class="p-4 pb-24 text-slate-100 min-h-screen bg-slate-900">
      <h1 class="text-2xl font-bold mb-6">Historique des achats</h1>
  
      <!-- Panneau de filtres -->
      <div class="bg-slate-800 p-4 rounded-xl mb-6 shadow-md">
        <div class="flex flex-col gap-4">
          <!-- Filtre par Mois -->
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-slate-400">Période</label>
            <input 
              type="month" 
              v-model="selectedMonth" 
              class="bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>
  
          <!-- Filtre par Magasin (Scroll horizontal) -->
          <div>
            <label class="text-sm font-medium text-slate-400 mb-2 block">Magasin</label>
            <div class="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
              <button
                v-for="store in stores"
                :key="store"
                @click="selectedStore = store"
                class="px-3 py-1.5 rounded-lg whitespace-nowrap text-sm font-medium transition-colors"
                :class="selectedStore === store ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'"
              >
                {{ store }}
              </button>
            </div>
          </div>
        </div>
      </div>
  
      <!-- Résumé financier -->
      <div class="flex justify-between items-center bg-gradient-to-r from-blue-900 to-slate-800 border border-blue-800/50 p-4 rounded-xl mb-6">
        <span class="font-medium text-blue-200">Total sur la période</span>
        <span class="text-2xl font-bold text-white">{{ totalSpent.toFixed(2) }} €</span>
      </div>
  
      <!-- Liste des achats -->
      <div v-if="filteredHistory.length > 0" class="space-y-3">
        <div 
          v-for="item in filteredHistory" 
          :key="item.id" 
          class="bg-slate-800 p-4 rounded-xl flex justify-between items-center"
        >
          <div>
            <p class="font-bold text-lg">{{ item.name }}</p>
            <div class="flex items-center gap-2 mt-1">
              <span class="px-2 py-0.5 bg-slate-700 rounded text-xs font-semibold text-blue-300">{{ item.store }}</span>
              <span class="text-xs text-slate-400">{{ formatDate(item.purchase_date) }}</span>
            </div>
          </div>
          <div class="text-right">
            <p class="font-bold text-lg">{{ item.price }} €</p>
            <p class="text-xs text-slate-400">Qté: {{ item.quantity }}</p>
          </div>
        </div>
      </div>
      
      <!-- État vide -->
      <div v-else class="text-center text-slate-500 py-10">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        <p>Aucun achat trouvé pour ces filtres.</p>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted } from 'vue'
  import { supabase } from '../supabase'
  
  const history = ref([])
  const stores = ['Tous', 'Leclerc', 'Carrefour', 'Lidl', 'Aldi', 'Action']
  const selectedStore = ref('Tous')
  
  // Initialise le mois sélectionné au mois actuel (format YYYY-MM)
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const selectedMonth = ref(currentMonth)
  
  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('purchase_history')
      .select('*')
      .order('purchase_date', { ascending: false })
      
    if (data) history.value = data
    if (error) console.error("Erreur de récupération :", error)
  }
  
  const filteredHistory = computed(() => {
    return history.value.filter(item => {
      // Filtre par magasin
      const matchStore = selectedStore.value === 'Tous' || item.store === selectedStore.value
      
      // Filtre par mois (on compare "YYYY-MM")
      const itemDate = new Date(item.purchase_date)
      const itemMonth = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`
      const matchMonth = selectedMonth.value === '' || itemMonth === selectedMonth.value
  
      return matchStore && matchMonth
    })
  })
  
  const totalSpent = computed(() => {
    return filteredHistory.value.reduce((total, item) => {
      // Le prix en base est le prix total de la ligne (ou unitaire, selon comment tu l'insères).
      // Si c'est unitaire, il faut faire `item.price * item.quantity`. 
      // Ici on assume que le champ 'price' est le prix total payé pour cette ligne.
      return total + parseFloat(item.price || 0)
    }, 0)
  })
  
  const formatDate = (isoString) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    return new Intl.DateTimeFormat('fr-FR', { 
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
    }).format(date)
  }
  
  onMounted(fetchHistory)
  </script>
  
  <style scoped>
  .scrollbar-hide::-webkit-scrollbar {
      display: none;
  }
  .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
  }
  </style>