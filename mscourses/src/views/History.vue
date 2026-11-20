<template>
  <div class="history-page">
    <div class="page-head">
      <h2>Historique</h2>
      <div class="period-pills">
        <button
          v-for="p in periods"
          :key="p.value"
          type="button"
          class="period-btn"
          :class="{ active: selectedPeriod === p.value }"
          @click="selectedPeriod = p.value"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <!-- Barre de stats -->
    <section class="stats-bar">
      <div class="stat-box">
        <span class="stat-label">Dépensé</span>
        <span class="stat-val primary">{{ totalSpent.toFixed(2) }} €</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-box">
        <span class="stat-label">Articles</span>
        <span class="stat-val">{{ filteredHistory.length }}</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-box">
        <span class="stat-label">Sorties</span>
        <span class="stat-val">{{ Object.keys(groupedByDate).length }}</span>
      </div>
    </section>

    <!-- Recherche + Filtre magasin -->
    <input
      v-model="searchQuery"
      type="text"
      placeholder="Rechercher un produit ou magasin..."
      class="search-input"
    />

    <div v-if="storeList.length > 1" class="filter-strip">
      <button
        type="button"
        class="filter-pill"
        :class="{ active: selectedStore === 'ALL' }"
        @click="selectedStore = 'ALL'"
      >
        Tous
      </button>
      <button
        v-for="st in storeList"
        :key="st"
        type="button"
        class="filter-pill"
        :class="{ active: selectedStore === st }"
        @click="selectedStore = st"
      >
        {{ st }}
      </button>
    </div>

    <!-- État vide -->
    <div v-if="!isLoading && filteredHistory.length === 0" class="ms-card empty-card">
      <p class="empty-title">Aucun achat sur cette période</p>
      <p class="empty-sub">Tes achats validés dans « En Rayon » apparaîtront ici.</p>
    </div>

    <!-- Groupes par date -->
    <section
      v-for="(items, dateLabel) in groupedByDate"
      :key="dateLabel"
      class="ms-card day-card"
    >
      <div class="day-header">
        <span class="day-label">{{ dateLabel }}</span>
        <span class="day-total">{{ sumItems(items).toFixed(2) }} €</span>
      </div>

      <div class="day-items">
        <div v-for="row in items" :key="row.id" class="hist-row">
          <div class="hist-left">
            <span class="hist-name">{{ row.name }}</span>
            <div class="hist-meta">
              <span class="store-tag">{{ row.store || 'Autre' }}</span>
              <span>{{ row.quantity ?? 1 }} {{ row.unit || 'unité(s)' }}</span>
            </div>
          </div>

          <div class="hist-right">
            <span class="hist-price">
              {{ Number(row.price || 0) > 0 ? `${Number(row.price).toFixed(2)} €` : '—' }}
            </span>
            <button
              type="button"
              class="mini-btn"
              title="Racheter (ajouter au brouillon)"
              @click="rebuyItem(row)"
            >
              🛒
            </button>
            <button
              type="button"
              class="mini-btn del"
              title="Supprimer"
              @click="deleteEntry(row.id)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </section>

    <div v-if="toastMsg" class="toast-banner" :class="toastType">
      {{ toastMsg }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const history = ref([])
const isLoading = ref(false)
const searchQuery = ref('')
const selectedStore = ref('ALL')
const selectedPeriod = ref('30d')
const toastMsg = ref('')
const toastType = ref('success')

const periods = [
  { value: '30d', label: '30 j' },
  { value: '90d', label: '3 mois' },
  { value: 'all', label: 'Tout' },
]

const showToast = (msg, type = 'success') => {
  toastMsg.value = msg
  toastType.value = type
  setTimeout(() => {
    toastMsg.value = ''
  }, 2600)
}

const storeList = computed(() => {
  const set = new Set(history.value.map(h => h.store || 'Autre'))
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const filteredHistory = computed(() => {
  const now = new Date()
  const q = searchQuery.value.trim().toLowerCase()

  return history.value.filter(h => {
    if (selectedStore.value !== 'ALL' && (h.store || 'Autre') !== selectedStore.value) {
      return false
    }
    if (q) {
      const hay = `${h.name || ''} ${h.store || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (selectedPeriod.value !== 'all' && h.purchase_date) {
      const d = new Date(h.purchase_date)
      const days = (now - d) / (1000 * 60 * 60 * 24)
      if (selectedPeriod.value === '30d' && days > 30) return false
      if (selectedPeriod.value === '90d' && days > 90) return false
    }
    return true
  })
})

const totalSpent = computed(() =>
  filteredHistory.value.reduce((sum, h) => sum + (Number(h.price) || 0), 0)
)

const groupedByDate = computed(() => {
  return filteredHistory.value.reduce((acc, row) => {
    const label = row.purchase_date
      ? new Date(row.purchase_date).toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
        })
      : 'Date inconnue'
    if (!acc[label]) acc[label] = []
    acc[label].push(row)
    return acc
  }, {})
})

const sumItems = (items) => items.reduce((s, i) => s + (Number(i.price) || 0), 0)

const fetchHistory = async () => {
  isLoading.value = true
  try {
    const { data, error } = await supabase
      .from('purchase_history')
      .select('*')
      .order('purchase_date', { ascending: false })
      .limit(200)
    if (!error && data) history.value = data
  } finally {
    isLoading.value = false
  }
}

const rebuyItem = async (row) => {
  const { error } = await supabase.from('draft_list').insert([
    {
      inventory_id: row.inventory_id ?? null,
      name: row.name,
      quantity: Number(row.quantity ?? 1) || 1,
      unit: row.unit || 'unité(s)',
      brand: null,
    },
  ])
  if (error) {
    showToast(`Erreur : ${error.message}`, 'error')
  } else {
    showToast(`"${row.name}" ajouté au brouillon`)
  }
}

const deleteEntry = async (id) => {
  if (!confirm('Supprimer cette ligne de l’historique ?')) return
  const { error } = await supabase.from('purchase_history').delete().eq('id', id)
  if (!error) {
    history.value = history.value.filter(h => h.id !== id)
    showToast('Entrée supprimée')
  }
}

onMounted(fetchHistory)
</script>

<style scoped>
.history-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.page-head h2 {
  font-size: 1.2rem;
  font-weight: 800;
}

.period-pills {
  display: flex;
  gap: 4px;
  padding: 3px;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

.period-btn {
  padding: 5px 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-light);
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
}

.period-btn.active {
  background-color: var(--primary);
  color: #ffffff;
}

.stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 12px 10px;
  box-shadow: var(--shadow);
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--text-light);
}

.stat-val {
  font-size: 1rem;
  font-weight: 800;
}

.stat-val.primary { color: var(--primary); }

.stat-sep {
  width: 1px;
  height: 28px;
  background-color: var(--border-color);
}

.search-input {
  width: 100%;
  height: 42px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background-color: var(--card-bg);
  font-size: 0.88rem;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
}

.filter-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-strip::-webkit-scrollbar { display: none; }

.filter-pill {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background-color: var(--card-bg);
  color: var(--text-light);
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.filter-pill.active {
  background-color: var(--primary);
  border-color: var(--primary);
  color: #ffffff;
}

.ms-card {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background-color: var(--surface-elevated);
  border-bottom: 1px solid var(--border-color);
}

.day-label {
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: capitalize;
  color: var(--text-light);
}

.day-total {
  font-size: 0.84rem;
  font-weight: 800;
  color: var(--primary);
}

.hist-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--border-color);
}

.hist-row:last-child { border-bottom: none; }

.hist-left {
  flex: 1;
  min-width: 0;
}

.hist-name {
  display: block;
  font-size: 0.9rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hist-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
  font-size: 0.74rem;
  color: var(--text-light);
}

.store-tag {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 6px;
  background-color: var(--primary-soft);
  color: var(--primary);
}

.hist-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.hist-price {
  font-size: 0.88rem;
  font-weight: 800;
  margin-right: 4px;
}

.mini-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  font-size: 0.78rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-btn.del {
  color: var(--danger);
  font-weight: 700;
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

.toast-banner {
  position: fixed;
  top: 68px;
  left: 16px;
  right: 16px;
  max-width: 508px;
  margin: 0 auto;
  padding: 10px 14px;
  border-radius: 12px;
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 700;
  text-align: center;
  z-index: 90;
}

.toast-banner.success { background-color: var(--success); }
.toast-banner.error { background-color: var(--danger); }
</style>