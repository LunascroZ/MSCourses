<template>
  <div class="stock-page">
    <!-- En-tête -->
    <div class="page-head">
      <h2>Stock & Inventaire</h2>
      <button type="button" class="add-btn" @click="openNewModal">
        + Produit
      </button>
    </div>

    <!-- Barre de stats -->
    <section class="stats-bar">
      <div class="stat-box">
        <span class="stat-label">Suivis</span>
        <span class="stat-val">{{ trackedCount }}</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-box">
        <span class="stat-label">Urgents</span>
        <span class="stat-val" :class="urgentItems.length > 0 ? 'danger' : 'success'">
          {{ urgentItems.length }}
        </span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-box">
        <span class="stat-label">Dispo</span>
        <span class="stat-val primary">{{ availabilityPct }}%</span>
      </div>
    </section>

    <!-- Recherche + Filtres -->
    <div class="search-wrap">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Rechercher dans le stock..."
        class="search-input"
      />
    </div>

    <div class="filter-strip">
      <button
        type="button"
        class="filter-pill"
        :class="{ active: activeFilter === 'ALL' }"
        @click="activeFilter = 'ALL'"
      >
        Tous ({{ inventory.length }})
      </button>
      <button
        type="button"
        class="filter-pill urgent-pill"
        :class="{ active: activeFilter === 'URGENT' }"
        @click="activeFilter = 'URGENT'"
      >
        ⚠️ Urgents ({{ urgentItems.length }})
      </button>
      <button
        v-for="cat in availableCategories"
        :key="cat"
        type="button"
        class="filter-pill"
        :class="{ active: activeFilter === cat }"
        @click="activeFilter = cat"
      >
        {{ cat }}
      </button>
    </div>

    <!-- État vide -->
    <div v-if="!isLoading && filteredInventory.length === 0" class="ms-card empty-card">
      <p class="empty-title">Aucun article trouvé</p>
      <p class="empty-sub">Ajuste ton filtre ou ajoute un produit au stock.</p>
    </div>

    <!-- Liste groupée par catégorie -->
    <section
      v-for="(items, category) in groupedInventory"
      :key="category"
      class="ms-card cat-card"
    >
      <div class="cat-header">
        <h3>{{ category }}</h3>
        <span class="cat-count">{{ items.length }}</span>
      </div>

      <div class="cat-items">
        <div
          v-for="item in items"
          :key="item.id"
          class="stock-row"
          :class="{ 'is-urgent': isUrgent(item) }"
        >
          <div class="stock-main">
            <div class="stock-title-line">
              <span class="stock-name">{{ item.name }}</span>
              <span
                class="status-badge"
                :class="isUrgent(item) ? 'urgent' : 'ok'"
              >
                {{ isUrgent(item) ? 'URGENT' : 'OK' }}
              </span>
            </div>

            <div class="stock-meta-line">
              <span>Seuil : {{ item.min_threshold ?? 0 }} {{ item.unit || 'unité(s)' }}</span>
              <span v-if="isUrgent(item)" class="buy-hint">
                → À acheter : {{ computeOrderQty(item) }} {{ item.unit || 'unité(s)' }}
              </span>
            </div>
          </div>

          <div class="stock-controls">
            <div class="qty-stepper">
              <button type="button" class="step-btn" @click="adjustStock(item, -1)">−</button>
              <button
                type="button"
                class="qty-val-btn"
                title="Appuyer pour ajuster rapidement"
                @click="openQuickAdjust(item)"
              >
                {{ item.current_quantity ?? 0 }}
                <small>{{ shortUnit(item.unit) }}</small>
              </button>
              <button type="button" class="step-btn" @click="adjustStock(item, 1)">+</button>
            </div>

            <button
              type="button"
              class="icon-action"
              title="Envoyer dans le brouillon"
              @click="exportSingleToDraft(item)"
            >
              🛒
            </button>
            <button
              type="button"
              class="icon-action"
              title="Modifier l'article"
              @click="openEditModal(item)"
            >
              ✏️
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Bouton flottant : Export des urgents vers DraftList -->
    <div v-if="urgentItems.length > 0" class="floating-cta">
      <button
        type="button"
        class="export-btn"
        :disabled="isExporting"
        @click="exportUrgentsToDraft"
      >
        <span v-if="isExporting">⏳ Export vers Brouillon...</span>
        <span v-else>📤 Exporter {{ urgentItems.length }} urgent(s) vers Brouillon</span>
      </button>
    </div>

    <!-- Modale Ajustement Rapide (tap sur la quantité) -->
    <div v-if="quickItem" class="modal-overlay" @click.self="closeQuickAdjust">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>Ajustement rapide</h3>
          <button type="button" class="modal-close" @click="closeQuickAdjust">✕</button>
        </div>

        <div class="quick-summary">
          <span class="quick-name">{{ quickItem.name }}</span>
          <span class="quick-current">
            Actuel : <strong>{{ quickItem.current_quantity ?? 0 }} {{ quickItem.unit || 'unité(s)' }}</strong>
          </span>
        </div>

        <!-- Raccourcis 1-tap adaptés à l'unité -->
        <div class="quick-presets">
          <button
            v-for="preset in quickPresets"
            :key="preset.label"
            type="button"
            class="preset-btn"
            @click="applyQuickDelta(preset.delta)"
          >
            {{ preset.label }}
          </button>
          <button
            type="button"
            class="preset-btn empty-preset"
            @click="setQuickExact(0)"
          >
            Vider (0)
          </button>
        </div>

        <!-- Mode personnalisé : Retirer / Ajouter / Définir -->
        <div class="mode-switch">
          <button
            type="button"
            class="mode-btn"
            :class="{ active: quickMode === 'sub' }"
            @click="quickMode = 'sub'"
          >
            − Retirer
          </button>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: quickMode === 'add' }"
            @click="quickMode = 'add'"
          >
            + Ajouter
          </button>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: quickMode === 'set' }"
            @click="quickMode = 'set'"
          >
            = Définir
          </button>
        </div>

        <form class="quick-input-row" @submit.prevent="submitQuickCustom">
          <input
            v-model.number="quickAmount"
            type="number"
            step="any"
            min="0"
            inputmode="decimal"
            :placeholder="`Quantité en ${quickItem.unit || 'unité(s)'}`"
            class="modal-input"
            autofocus
          />
          <button type="submit" class="btn-save quick-apply">
            OK
          </button>
        </form>

        <p v-if="quickPreview !== null" class="quick-preview">
          Nouveau stock : <strong>{{ quickPreview }} {{ quickItem.unit || 'unité(s)' }}</strong>
        </p>
      </div>
    </div>

    <!-- Modale Création / Édition -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>{{ editingId ? 'Modifier le produit' : 'Nouveau produit en stock' }}</h3>
          <button type="button" class="modal-close" @click="closeModal">✕</button>
        </div>

        <div class="modal-form">
          <div class="field-group">
            <label>Nom du produit</label>
            <input v-model="form.name" type="text" placeholder="Ex: Riz Basmati" class="modal-input" />
          </div>

          <div class="field-row-2">
            <div class="field-group">
              <label>Catégorie</label>
              <select v-model="form.category" class="modal-input">
                <option v-for="c in categoryOptions" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div class="field-group">
              <label>Unité</label>
              <select v-model="form.unit" class="modal-input">
                <option v-for="u in unitOptions" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
          </div>

          <div class="field-row-3">
            <div class="field-group">
              <label>Stock actuel</label>
              <input v-model.number="form.current_quantity" type="number" step="any" min="0" class="modal-input" />
            </div>
            <div class="field-group">
              <label>Seuil alerte</label>
              <input v-model.number="form.min_threshold" type="number" step="any" min="0" class="modal-input" />
            </div>
            <div class="field-group">
              <label>Qté achat</label>
              <input v-model.number="form.buy_quantity" type="number" step="any" min="0.01" class="modal-input" />
            </div>
          </div>

          <label class="checkbox-row">
            <input v-model="form.is_stock_item" type="checkbox" />
            <span>Article suivi en réapprovisionnement automatique</span>
          </label>

          <div class="modal-actions">
            <button
              v-if="editingId"
              type="button"
              class="btn-delete"
              @click="deleteItem"
            >
              🗑️
            </button>
            <button type="button" class="btn-cancel" @click="closeModal">Annuler</button>
            <button type="button" class="btn-save" :disabled="isSaving" @click="saveItem">
              {{ isSaving ? 'Enregistrement...' : 'Enregistrer' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toastMsg" class="toast-banner" :class="toastType">
      {{ toastMsg }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'

const router = useRouter()
const inventory = ref([])
const isLoading = ref(false)
const isExporting = ref(false)
const searchQuery = ref('')
const activeFilter = ref('ALL')
const toastMsg = ref('')
const toastType = ref('success')

// État modale ajustement rapide
const quickItem = ref(null)
const quickMode = ref('sub') // 'sub' | 'add' | 'set'
const quickAmount = ref(null)

// État modale création / édition
const showModal = ref(false)
const editingId = ref(null)
const isSaving = ref(false)
const form = ref({
  name: '',
  category: 'Autre',
  unit: 'unité(s)',
  current_quantity: 0,
  min_threshold: 1,
  buy_quantity: 1,
  is_stock_item: true,
})

const unitOptions = ['unité(s)', 'g', 'kg', 'L', 'ml', 'lot(s)', 'boîte(s)']
const categoryOptions = [
  'Congélateur',
  'Frigo',
  'Produit Frais',
  'Épicerie salée',
  'Épicerie sucrée',
  'Hygiène',
  "Produits d'entretien",
  'Autre',
]

let realtimeChannel

const showToast = (msg, type = 'success') => {
  toastMsg.value = msg
  toastType.value = type
  setTimeout(() => {
    toastMsg.value = ''
  }, 3000)
}

const isUrgent = (item) => {
  const threshold = Number(item.min_threshold ?? 0)
  const current = Number(item.current_quantity ?? 0)
  return threshold > 0 && current < threshold
}

const computeOrderQty = (item) => {
  const threshold = Number(item.min_threshold ?? 0)
  const current = Number(item.current_quantity ?? 0)
  const buyStep = Number(item.buy_quantity ?? 1) > 0 ? Number(item.buy_quantity) : 1
  const missing = Math.max(0, threshold - current)
  if (missing === 0) return buyStep
  return Math.ceil(missing / buyStep) * buyStep
}

const shortUnit = (u) => {
  if (!u || u.startsWith('unité')) return 'u'
  return u
}

const urgentItems = computed(() => inventory.value.filter(isUrgent))

const trackedCount = computed(() =>
  inventory.value.filter(i => i.is_stock_item !== false).length
)

const availabilityPct = computed(() => {
  if (inventory.value.length === 0) return 100
  const okCount = inventory.value.length - urgentItems.value.length
  return Math.round((okCount / inventory.value.length) * 100)
})

const availableCategories = computed(() => {
  const set = new Set(inventory.value.map(i => i.category || 'Autre'))
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const filteredInventory = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return inventory.value.filter(item => {
    if (q && !(item.name || '').toLowerCase().includes(q)) return false
    if (activeFilter.value === 'URGENT') return isUrgent(item)
    if (activeFilter.value !== 'ALL') return (item.category || 'Autre') === activeFilter.value
    return true
  })
})

const groupedInventory = computed(() => {
  return filteredInventory.value.reduce((acc, item) => {
    const cat = item.category || 'Autre'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})
})

// Raccourcis dynamiques selon l'unité de l'article
const quickPresets = computed(() => {
  if (!quickItem.value) return []
  const u = (quickItem.value.unit || '').toLowerCase()
  if (u === 'g' || u === 'ml') {
    return [
      { label: `-100 ${u}`, delta: -100 },
      { label: `-250 ${u}`, delta: -250 },
      { label: `-500 ${u}`, delta: -500 },
      { label: `-1000 ${u}`, delta: -1000 },
    ]
  }
  if (u === 'kg' || u === 'l') {
    return [
      { label: `-0.5 ${quickItem.value.unit}`, delta: -0.5 },
      { label: `-1 ${quickItem.value.unit}`, delta: -1 },
      { label: `-2 ${quickItem.value.unit}`, delta: -2 },
    ]
  }
  return [
    { label: '-1', delta: -1 },
    { label: '-2', delta: -2 },
    { label: '-5', delta: -5 },
    { label: '-10', delta: -10 },
  ]
})

const quickPreview = computed(() => {
  if (!quickItem.value || quickAmount.value === null || quickAmount.value === '') return null
  const val = Number(quickAmount.value)
  if (!Number.isFinite(val) || val < 0) return null
  const current = Number(quickItem.value.current_quantity ?? 0) || 0
  if (quickMode.value === 'sub') return Math.max(0, Number((current - val).toFixed(2)))
  if (quickMode.value === 'add') return Number((current + val).toFixed(2))
  return Number(val.toFixed(2))
})

const openQuickAdjust = (item) => {
  quickItem.value = item
  quickMode.value = 'sub'
  quickAmount.value = null
}

const closeQuickAdjust = () => {
  quickItem.value = null
  quickAmount.value = null
}

const updateStockValue = async (item, nextQty) => {
  const safeNext = Math.max(0, Number(Number(nextQty).toFixed(2)))
  item.current_quantity = safeNext
  const { error } = await supabase
    .from('inventory')
    .update({ current_quantity: safeNext, updated_at: new Date().toISOString() })
    .eq('id', item.id)

  if (error) {
    showToast(`Erreur : ${error.message}`, 'error')
  }
}

const applyQuickDelta = async (delta) => {
  if (!quickItem.value) return
  const current = Number(quickItem.value.current_quantity ?? 0) || 0
  await updateStockValue(quickItem.value, current + delta)
  showToast(`${quickItem.value.name} → ${quickItem.value.current_quantity} ${quickItem.value.unit || 'u'}`)
  closeQuickAdjust()
}

const setQuickExact = async (val) => {
  if (!quickItem.value) return
  await updateStockValue(quickItem.value, val)
  showToast(`${quickItem.value.name} → ${quickItem.value.current_quantity} ${quickItem.value.unit || 'u'}`)
  closeQuickAdjust()
}

const submitQuickCustom = async () => {
  if (!quickItem.value || quickPreview.value === null) return
  await setQuickExact(quickPreview.value)
}

const fetchInventory = async () => {
  isLoading.value = true
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('name', { ascending: true })
    if (!error && data) inventory.value = data
  } finally {
    isLoading.value = false
  }
}

const adjustStock = async (item, delta) => {
  const u = (item.unit || '').toLowerCase()
  const step = u === 'g' || u === 'ml' ? 100 : 1
  const current = Number(item.current_quantity ?? 0) || 0
  await updateStockValue(item, current + delta * step)
}

const exportSingleToDraft = async (item) => {
  const qty = computeOrderQty(item)
  const { data: existing } = await supabase
    .from('draft_list')
    .select('id, name, inventory_id')

  const alreadyInDraft = (existing || []).some(
    d =>
      d.inventory_id === item.id ||
      (d.name || '').toLowerCase().trim() === (item.name || '').toLowerCase().trim()
  )

  if (alreadyInDraft) {
    showToast(`"${item.name}" est déjà dans le brouillon`, 'error')
    return
  }

  const { error } = await supabase.from('draft_list').insert([
    {
      inventory_id: item.id,
      name: item.name,
      quantity: qty,
      unit: item.unit || 'unité(s)',
      brand: null,
    },
  ])

  if (error) {
    showToast(`Erreur export : ${error.message}`, 'error')
  } else {
    showToast(`"${item.name}" (${qty} ${item.unit || 'u'}) envoyé au brouillon`)
  }
}

const exportUrgentsToDraft = async () => {
  if (urgentItems.value.length === 0 || isExporting.value) return
  isExporting.value = true

  try {
    const { data: existingDrafts, error: fetchErr } = await supabase
      .from('draft_list')
      .select('id, name, inventory_id')

    if (fetchErr) throw fetchErr

    const existingIds = new Set((existingDrafts || []).map(d => d.inventory_id).filter(Boolean))
    const existingNames = new Set(
      (existingDrafts || []).map(d => (d.name || '').toLowerCase().trim())
    )

    const toInsert = urgentItems.value
      .filter(
        item =>
          !existingIds.has(item.id) &&
          !existingNames.has((item.name || '').toLowerCase().trim())
      )
      .map(item => ({
        inventory_id: item.id,
        name: item.name,
        quantity: computeOrderQty(item),
        unit: item.unit || 'unité(s)',
        brand: null,
      }))

    if (toInsert.length === 0) {
      showToast('Tous les articles urgents sont déjà dans le brouillon')
      return
    }

    const { error: insErr } = await supabase.from('draft_list').insert(toInsert)
    if (insErr) throw insErr

    showToast(`${toInsert.length} article(s) urgent(s) exporté(s) → Brouillon`)
    setTimeout(() => router.push('/draft'), 700)
  } catch (err) {
    console.error('Erreur export urgents:', err)
    showToast(`Erreur : ${err?.message || err}`, 'error')
  } finally {
    isExporting.value = false
  }
}

const openNewModal = () => {
  editingId.value = null
  form.value = {
    name: '',
    category: 'Autre',
    unit: 'unité(s)',
    current_quantity: 0,
    min_threshold: 1,
    buy_quantity: 1,
    is_stock_item: true,
  }
  showModal.value = true
}

const openEditModal = (item) => {
  editingId.value = item.id
  form.value = {
    name: item.name || '',
    category: item.category || 'Autre',
    unit: item.unit || 'unité(s)',
    current_quantity: Number(item.current_quantity ?? 0),
    min_threshold: Number(item.min_threshold ?? 0),
    buy_quantity: Number(item.buy_quantity ?? 1) || 1,
    is_stock_item: item.is_stock_item !== false,
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const saveItem = async () => {
  if (!form.value.name.trim() || isSaving.value) return
  isSaving.value = true

  try {
    const payload = {
      name: form.value.name.trim(),
      category: form.value.category || 'Autre',
      unit: form.value.unit || 'unité(s)',
      current_quantity: Math.max(0, Number(form.value.current_quantity) || 0),
      min_threshold: Math.max(0, Number(form.value.min_threshold) || 0),
      buy_quantity: Number(form.value.buy_quantity) > 0 ? Number(form.value.buy_quantity) : 1,
      is_stock_item: Boolean(form.value.is_stock_item),
      updated_at: new Date().toISOString(),
    }

    if (editingId.value) {
      const { error } = await supabase
        .from('inventory')
        .update(payload)
        .eq('id', editingId.value)
      if (error) throw error
      showToast('Produit mis à jour')
    } else {
      const { error } = await supabase
        .from('inventory')
        .insert([{ ...payload, created_at: new Date().toISOString() }])
      if (error) throw error
      showToast('Produit ajouté au stock')
    }

    closeModal()
    await fetchInventory()
  } catch (err) {
    showToast(`Erreur : ${err?.message || err}`, 'error')
  } finally {
    isSaving.value = false
  }
}

const deleteItem = async () => {
  if (!editingId.value || !confirm('Supprimer cet article du stock ?')) return
  await supabase.from('inventory').delete().eq('id', editingId.value)
  inventory.value = inventory.value.filter(i => i.id !== editingId.value)
  closeModal()
  showToast('Produit supprimé')
}

onMounted(() => {
  fetchInventory()
  realtimeChannel = supabase
    .channel('inventory_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
      fetchInventory()
    })
    .subscribe()
})

onUnmounted(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})
</script>

<style scoped>
.stock-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-head h2 {
  font-size: 1.2rem;
  font-weight: 800;
}

.add-btn {
  padding: 7px 14px;
  border-radius: 10px;
  border: none;
  background-color: var(--primary);
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
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
.stat-val.success { color: var(--success); }
.stat-val.danger { color: var(--danger); }

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
  color: var(--text-main);
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
  padding-bottom: 2px;
  scrollbar-width: none;
}

.filter-strip::-webkit-scrollbar {
  display: none;
}

.filter-pill {
  padding: 7px 12px;
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

.filter-pill.urgent-pill.active {
  background-color: var(--danger);
  border-color: var(--danger);
}

.ms-card {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.cat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background-color: var(--surface-elevated);
  border-bottom: 1px solid var(--border-color);
}

.cat-header h3 {
  font-size: 0.88rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--text-light);
}

.cat-count {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background-color: var(--input-bg);
  color: var(--text-main);
}

.stock-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
}

.stock-row:last-child {
  border-bottom: none;
}

.stock-row.is-urgent {
  border-left: 4px solid var(--danger);
}

.stock-title-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stock-name {
  font-size: 0.92rem;
  font-weight: 700;
}

.status-badge {
  font-size: 0.66rem;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 6px;
  flex-shrink: 0;
}

.status-badge.ok {
  background-color: rgba(16, 185, 129, 0.14);
  color: var(--success);
}

.status-badge.urgent {
  background-color: rgba(239, 68, 68, 0.16);
  color: var(--danger);
}

.stock-meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 0.74rem;
  color: var(--text-light);
  margin-top: 2px;
}

.buy-hint {
  color: var(--danger);
  font-weight: 700;
}

.stock-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.qty-stepper {
  display: flex;
  align-items: center;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  flex: 1;
  max-width: 185px;
}

.step-btn {
  width: 38px;
  height: 100%;
  border: none;
  background: transparent;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--primary);
  cursor: pointer;
}

.qty-val-btn {
  flex: 1;
  height: 100%;
  border: none;
  border-left: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-main);
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
}

.qty-val-btn small {
  font-weight: 600;
  color: var(--text-light);
  margin-left: 2px;
}

.icon-action {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.88rem;
  cursor: pointer;
}

.floating-cta {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(64px + env(safe-area-inset-bottom));
  padding: 10px 16px;
  background: linear-gradient(to top, var(--bg-color) 75%, transparent);
  z-index: 35;
}

.export-btn {
  max-width: 508px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  border: none;
  border-radius: 14px;
  background: var(--cta-gradient);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.9rem;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.28);
  cursor: pointer;
}

.export-btn:disabled {
  opacity: 0.5;
}

/* Modales */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 80;
  padding: 12px;
}

.modal-sheet {
  width: 100%;
  max-width: 500px;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 18px;
  margin-bottom: env(safe-area-inset-bottom);
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.modal-head h3 {
  font-size: 1rem;
  font-weight: 800;
}

.modal-close {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-main);
  font-weight: 700;
  cursor: pointer;
}

/* Ajustement rapide */
.quick-summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.quick-name {
  font-size: 0.92rem;
  font-weight: 700;
}

.quick-current {
  font-size: 0.78rem;
  color: var(--text-light);
}

.quick-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.preset-btn {
  flex: 1 1 auto;
  min-width: 72px;
  height: 38px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-main);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.preset-btn.empty-preset {
  background-color: rgba(239, 68, 68, 0.14);
  border-color: rgba(239, 68, 68, 0.35);
  color: var(--danger);
}

.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
  padding: 4px;
  border-radius: 12px;
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  margin-bottom: 10px;
}

.mode-btn {
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-light);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.mode-btn.active {
  background-color: var(--primary);
  color: #ffffff;
}

.quick-input-row {
  display: flex;
  gap: 8px;
}

.quick-apply {
  flex: 0 0 84px;
  height: 40px;
}

.quick-preview {
  margin-top: 8px;
  font-size: 0.78rem;
  color: var(--text-light);
  text-align: right;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-group label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-light);
}

.field-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.field-row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.modal-input {
  height: 40px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-main);
  font-size: 0.86rem;
  font-weight: 600;
  width: 100%;
}

.modal-input:focus {
  outline: none;
  border-color: var(--primary);
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text-main);
}

.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.btn-delete {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background-color: rgba(239, 68, 68, 0.12);
  cursor: pointer;
}

.btn-cancel {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-main);
  font-weight: 700;
  cursor: pointer;
}

.btn-save {
  flex: 1.5;
  height: 44px;
  border-radius: 12px;
  border: none;
  background-color: var(--primary);
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
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
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.toast-banner.success { background-color: var(--success); }
.toast-banner.error { background-color: var(--danger); }
</style>