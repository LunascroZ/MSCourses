<template>
    <div class="p-4 pb-24 text-slate-100 min-h-screen bg-slate-900">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Stock & Inventaire</h1>
      </div>
  
      <!-- Bouton de bascule vers le brouillon (Visible uniquement si stock manquant) -->
      <button
        v-if="missingItems.length > 0"
        @click="sendToDraft"
        class="w-full mb-6 bg-orange-600 hover:bg-orange-500 transition py-4 rounded-xl font-bold shadow-lg flex justify-center items-center gap-2"
      >
        <span>⚠️ Ajouter {{ missingItems.length }} manquant(s) au brouillon</span>
      </button>
      <div v-else class="w-full mb-6 bg-green-900/30 text-green-400 border border-green-800/50 py-3 rounded-xl text-center font-medium">
        ✅ Le stock est au top
      </div>
  
      <!-- Filtres de catégories (Scroll horizontal) -->
      <div class="flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide">
        <button
          v-for="cat in categories"
          :key="cat"
          @click="selectedCategory = cat"
          class="px-4 py-2 rounded-full whitespace-nowrap font-medium transition-colors"
          :class="selectedCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'"
        >
          {{ cat }}
        </button>
      </div>
  
      <!-- Liste d'inventaire -->
      <div class="space-y-3">
        <div
          v-for="item in filteredInventory"
          :key="item.id"
          class="bg-slate-800 p-4 rounded-xl flex justify-between items-center border-l-4 transition-colors"
          :class="item.current_quantity < item.min_threshold ? 'border-orange-500' : 'border-slate-600'"
        >
          <div class="flex-1">
            <p class="font-bold text-lg" :class="{'text-orange-400': item.current_quantity < item.min_threshold}">
              {{ item.name }}
            </p>
            <p class="text-xs text-slate-400 mt-1">
              Alerte à : {{ item.min_threshold }} | Achète par : {{ item.purchase_quantity }}
            </p>
          </div>
  
          <!-- Contrôle des quantités -->
          <div class="flex items-center gap-3 bg-slate-900 rounded-lg p-1 ml-4 shadow-inner">
            <button 
              @click="updateStock(item, -1)" 
              class="w-10 h-10 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-md text-xl font-bold transition-colors"
            >
              -
            </button>
            <span class="w-6 text-center font-bold text-lg">
              {{ item.current_quantity }}
            </span>
            <button 
              @click="updateStock(item, 1)" 
              class="w-10 h-10 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-md text-xl font-bold transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted } from 'vue'
  import { useRouter } from 'vue-router'
  import { supabase } from '../supabase'
  
  const router = useRouter()
  const inventory = ref([])
  const selectedCategory = ref('Tous')
  
  // Récupération des articles monitorés (is_stock_item = true)
  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('is_stock_item', true)
      .order('category')
      .order('name')
      
    if (data) inventory.value = data
    if (error) console.error("Erreur de récupération :", error)
  }
  
  // Génération dynamique des catégories à partir des données
  const categories = computed(() => {
    const cats = new Set(inventory.value.map(i => i.category || 'Non classé'))
    return ['Tous', ...Array.from(cats).sort()]
  })
  
  // Filtrage de la liste affichée
  const filteredInventory = computed(() => {
    if (selectedCategory.value === 'Tous') return inventory.value
    return inventory.value.filter(i => (i.category || 'Non classé') === selectedCategory.value)
  })
  
  // Détection des articles sous le seuil d'alerte
  const missingItems = computed(() => {
    return inventory.value.filter(i => i.current_quantity < i.min_threshold)
  })
  
  // Mise à jour optimiste (l'UI change tout de suite, la requête part en fond)
  const updateStock = async (item, delta) => {
    const newQty = Math.max(0, parseFloat(item.current_quantity) + delta) // Pas de stock négatif
    item.current_quantity = newQty
  
    // Commente cette partie si tu n'as pas encore mis tes clés Supabase
    await supabase
      .from('inventory')
      .update({ current_quantity: newQty })
      .eq('id', item.id)
  }
  
  // Bascule vers la table draft_list
  const sendToDraft = async () => {
    if (missingItems.value.length === 0) return
  
    // On prépare le payload avec les quantités par défaut (ex: "Poulet" -> achète par "2" kg)
    const draftsToInsert = missingItems.value.map(item => ({
      inventory_id: item.id,
      name: item.name,
      quantity: item.purchase_quantity || 1
    }))
  
    const { error } = await supabase
      .from('draft_list')
      .insert(draftsToInsert)
  
    if (!error) {
      // Redirection automatique vers l'onglet Brouillon pour lancer l'IA
      router.push('/draft')
    } else {
      console.error("Erreur lors de l'ajout au brouillon:", error)
    }
  }
  
  onMounted(fetchInventory)
  </script>
  
  <style scoped>
  /* Pour cacher la barre de défilement native des catégories tout en gardant le scroll tactile */
  .scrollbar-hide::-webkit-scrollbar {
      display: none;
  }
  .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
  }
  </style>