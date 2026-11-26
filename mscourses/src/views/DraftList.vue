<template>
  <div class="draft-page">
    <!-- Segmented Control Secteur -->
    <div class="segmented-control">
      <button
        v-for="sec in SECTORS"
        :key="sec.value"
        type="button"
        class="segment-btn"
        :class="{ active: activeSector === sec.value }"
        :disabled="isUpdatingSector"
        @click="setSector(sec.value)"
      >
        <span class="seg-title">{{ sec.label }}</span>
        <span class="seg-sub">{{ sec.short }}</span>
      </button>
    </div>

    <!-- Carte Ajout Rapide -->
    <section class="ms-card">
      <form @submit.prevent="addDraft()" class="add-form">
        <div class="input-row">
          <input
            v-model="newItemName"
            type="text"
            placeholder="Ajouter un produit (ex: Skyr, Poulet...)"
            class="text-input"
          />
          <button
            type="submit"
            class="add-submit-btn"
            :disabled="!newItemName.trim()"
          >
            + Ajouter
          </button>
        </div>

        <div class="controls-row">
          <div class="qty-stepper">
            <button type="button" class="step-btn" @click="adjustNewQty(-1)">−</button>
            <input
              v-model.number="newItemQty"
              type="number"
              step="any"
              min="0.01"
              class="qty-input"
            />
            <button type="button" class="step-btn" @click="adjustNewQty(1)">+</button>
          </div>

          <select v-model="newItemUnit" class="unit-select">
            <option v-for="u in unitOptions" :key="u" :value="u">{{ u }}</option>
          </select>

          <button
            type="button"
            class="brand-toggle-btn"
            :class="{ active: showBrandField || newItemBrand }"
            @click="showBrandField = !showBrandField"
          >
            {{ showBrandField ? '− Marque' : '+ Marque' }}
          </button>
        </div>

        <input
          v-if="showBrandField"
          v-model="newItemBrand"
          type="text"
          placeholder="Marque souhaitée (optionnel, ex: Repère, MyProtein...)"
          class="brand-input"
        />
      </form>

      <!-- Suggestions Stock Bas -->
      <div v-if="lowStockSuggestions.length > 0" class="suggestions-bar">
        <span class="sug-label">⚡ Stock bas :</span>
        <div class="sug-chips">
          <button
            v-for="item in lowStockSuggestions"
            :key="item.id"
            type="button"
            class="chip-btn"
            @click="quickAddFromStock(item)"
          >
            + {{ item.name }}
          </button>
        </div>
      </div>
    </section>

    <!-- Carte Liste Brouillon -->
    <section class="ms-card list-card">
      <div class="list-header">
        <div class="list-title-group">
          <h2>Brouillon</h2>
          <span class="count-badge">{{ drafts.length }}</span>
        </div>
        <button
          v-if="drafts.length > 0"
          type="button"
          class="clear-btn"
          @click="clearAllDrafts"
        >
          Vider
        </button>
      </div>

      <div v-if="drafts.length > 0" class="items-list">
        <div v-for="item in drafts" :key="item.id" class="draft-row">
          <div class="item-info">
            <div class="item-name-line">
              <span class="item-name">{{ item.name }}</span>
              <span v-if="item.brand" class="brand-tag">{{ item.brand }}</span>
            </div>
            <span class="item-meta">{{ item.quantity ?? 1 }} {{ item.unit || 'unité(s)' }}</span>
          </div>

          <div class="item-actions">
            <div class="mini-stepper">
              <button type="button" class="mini-step" @click="updateItemQty(item, -1)">−</button>
              <span class="mini-val">{{ item.quantity ?? 1 }}</span>
              <button type="button" class="mini-step" @click="updateItemQty(item, 1)">+</button>
            </div>
            <button
              type="button"
              class="del-btn"
              @click="deleteDraft(item.id)"
              aria-label="Supprimer"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <div v-else class="empty-box">
        Aucun article dans le brouillon.
      </div>
    </section>

    <div class="weekly-note-box">
  <div class="note-head">
    <label for="weekly-note">🎟️ Bon d'achat / Info semaine (optionnel)</label>
    <button
      v-if="weeklyNote"
      type="button"
      class="clear-note-btn"
      @click="weeklyNote = ''"
    >
      Effacer
    </button>
  </div>
  <input
    id="weekly-note"
    v-model="weeklyNote"
    type="text"
    placeholder="Ex: 8€ dès 40€ chez Carrefour, pas le temps d'aller chez Lidl..."
    class="note-input"
  />
</div>
    <!-- Bouton flottant au-dessus de la TabBar -->
    <div class="floating-cta">
      <button
        type="button"
        class="gemini-btn"
        :disabled="isOptimizing || drafts.length === 0"
        @click="optimizeWithGemini"
      >
        <span v-if="isOptimizing">⏳ Arbitrage en cours...</span>
        <span v-else>✨ Optimiser avec Gemini ({{ drafts.length }})</span>
      </button>
    </div>

    <!-- Toast -->
    <div v-if="toastMsg" class="toast-banner" :class="toastType">
      {{ toastMsg }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { useSector } from '../composables/useSector'

const router = useRouter()
const { SECTORS, activeSector, isUpdatingSector, setSector } = useSector()

const drafts = ref([])
const lowStockItems = ref([])
const newItemName = ref('')
const newItemQty = ref(1)
const newItemUnit = ref('unité(s)')
const newItemBrand = ref('')
const showBrandField = ref(false)
const isOptimizing = ref(false)
const toastMsg = ref('')
const toastType = ref('success')
let realtimeChannel

const unitOptions = ['unité(s)', 'g', 'kg', 'L', 'ml', 'lot(s)', 'boîte(s)']

const showToast = (msg, type = 'success') => {
  toastMsg.value = msg
  toastType.value = type
  setTimeout(() => {
    toastMsg.value = ''
  }, 2800)
}

const lowStockSuggestions = computed(() => {
  const existingNames = new Set(drafts.value.map(d => d.name.toLowerCase().trim()))
  return lowStockItems.value
    .filter(i => !existingNames.has((i.name || '').toLowerCase().trim()))
    .slice(0, 6)
})

const fetchDrafts = async () => {
  const { data } = await supabase
    .from('draft_list')
    .select('*')
    .order('created_at', { ascending: false })
  if (data) drafts.value = data
}

const fetchLowStock = async () => {
  const { data } = await supabase
    .from('inventory')
    .select('id, name, current_quantity, min_threshold, unit')
    .eq('is_stock_item', true)

  if (data) {
    lowStockItems.value = data.filter(
      i => (Number(i.current_quantity) || 0) <= (Number(i.min_threshold) || 0)
    )
  }
}

const adjustNewQty = (delta) => {
  const step = newItemUnit.value === 'g' || newItemUnit.value === 'ml' ? 100 : 1
  const next = (Number(newItemQty.value) || 1) + delta * step
  newItemQty.value = next > 0 ? next : step
}

const addDraft = async (override = null) => {
  const name = (override?.name ?? newItemName.value).trim()
  if (!name) return

  const qty = Number(override?.quantity ?? newItemQty.value) > 0
    ? Number(override?.quantity ?? newItemQty.value)
    : 1
  const unit = override?.unit || newItemUnit.value || 'unité(s)'
  const brand = override ? null : newItemBrand.value.trim() || null

  const { data, error } = await supabase
    .from('draft_list')
    .insert([
      {
        inventory_id: override?.inventory_id ?? null,
        name,
        quantity: qty,
        unit,
        brand,
      },
    ])
    .select()

  if (!error && data) {
    if (!drafts.value.some(d => d.id === data[0].id)) {
      drafts.value.unshift(data[0])
    }
    if (!override) {
      newItemName.value = ''
      newItemQty.value = 1
      newItemUnit.value = 'unité(s)'
      newItemBrand.value = ''
    }
    showToast(`"${name}" ajouté`)
  }
}

const quickAddFromStock = (invItem) => {
  addDraft({
    inventory_id: invItem.id,
    name: invItem.name,
    quantity: 1,
    unit: invItem.unit || 'unité(s)',
  })
}

const updateItemQty = async (item, delta) => {
  const step = item.unit === 'g' || item.unit === 'ml' ? 100 : 1
  const next = (Number(item.quantity) || 1) + delta * step
  if (next <= 0) {
    return deleteDraft(item.id)
  }
  item.quantity = next
  await supabase.from('draft_list').update({ quantity: next }).eq('id', item.id)
}

const deleteDraft = async (id) => {
  await supabase.from('draft_list').delete().eq('id', id)
  drafts.value = drafts.value.filter(d => d.id !== id)
}

const clearAllDrafts = async () => {
  if (!confirm('Vider tout le brouillon ?')) return
  await supabase.from('draft_list').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  drafts.value = []
}

const optimizeWithGemini = async () => {
  if (drafts.value.length === 0 || isOptimizing.value) return
  isOptimizing.value = true

 const { data, error } = await supabase.functions.invoke('generate-shopping-plan', {
  body: {
    sector: activeSector.value,
    weekly_note: weeklyNote.value.trim(),
  },
})

  isOptimizing.value = false
  if (error) {
    let errMsg = error.message
    try {
      const bodyText = await error.context?.text()
      if (bodyText) {
        const parsed = JSON.parse(bodyText)
        errMsg = parsed.error || bodyText
      }
    } catch {
      // Fallback
    }
    showToast('Erreur Gemini : ' + errMsg, 'error')
  } else {
    router.push('/shopping')
  }
}
const weeklyNote = ref(localStorage.getItem('mscourses_weekly_note') || '')

watch(weeklyNote, (val) => {
  localStorage.setItem('mscourses_weekly_note', val)
})

onMounted(() => {
  fetchDrafts()
  fetchLowStock()
  realtimeChannel = supabase
    .channel('draft_list_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_list' }, () => {
      fetchDrafts()
    })
    .subscribe()
})

onUnmounted(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})
</script>

<style scoped>
.draft-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Segmented Control */
.segmented-control {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 5px;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: var(--shadow);
}

.segment-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-light);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.segment-btn.active {
  background-color: var(--primary);
  color: #ffffff;
}

.seg-title {
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.2;
}

.seg-sub {
  font-size: 0.68rem;
  opacity: 0.85;
  margin-top: 2px;
}

/* Cards */
.ms-card {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 14px;
  box-shadow: var(--shadow);
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-row {
  display: flex;
  gap: 8px;
}

.text-input {
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  font-size: 0.9rem;
}

.text-input:focus,
.brand-input:focus {
  outline: none;
  border-color: var(--primary);
}

.add-submit-btn {
  height: 44px;
  padding: 0 16px;
  border: none;
  border-radius: 10px;
  background-color: var(--primary);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  flex-shrink: 0;
}

.add-submit-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qty-stepper {
  display: flex;
  align-items: center;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  overflow: hidden;
  flex: 1;
}

.step-btn {
  width: 36px;
  height: 100%;
  border: none;
  background: transparent;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  color: var(--primary);
}

.qty-input {
  width: 100%;
  min-width: 0;
  border: none;
  background: transparent;
  text-align: center;
  font-weight: 700;
  font-size: 0.85rem;
}

.qty-input:focus {
  outline: none;
}

.unit-select {
  height: 38px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  font-size: 0.82rem;
  font-weight: 600;
}

.brand-toggle-btn {
  height: 38px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-light);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.brand-toggle-btn.active {
  border-color: var(--primary);
  color: var(--primary);
}

.brand-input {
  height: 38px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  font-size: 0.82rem;
}

/* Suggestions */
.suggestions-bar {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}

.sug-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-light);
  margin-bottom: 6px;
}

.sug-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip-btn {
  padding: 5px 10px;
  border-radius: 999px;
  border: none;
  background-color: var(--primary-soft);
  color: var(--primary);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

/* Liste brouillon */
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.list-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.list-title-group h2 {
  font-size: 1rem;
  font-weight: 800;
}

.count-badge {
  padding: 2px 8px;
  border-radius: 999px;
  background-color: var(--primary-soft);
  color: var(--primary);
  font-size: 0.75rem;
  font-weight: 700;
}

.clear-btn {
  border: none;
  background: transparent;
  color: var(--danger);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.items-list {
  display: flex;
  flex-direction: column;
}

.draft-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 0;
  border-bottom: 1px solid var(--border-color);
}

.draft-row:last-child {
  border-bottom: none;
  padding-bottom: 2px;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name-line {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.item-name {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text-main);
}

.brand-tag {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 6px;
  background-color: var(--primary-soft);
  color: var(--primary);
}

.item-meta {
  display: block;
  font-size: 0.75rem;
  color: var(--text-light);
  margin-top: 2px;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.mini-stepper {
  display: flex;
  align-items: center;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
}

.mini-step {
  width: 28px;
  height: 100%;
  border: none;
  background: transparent;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--primary);
  cursor: pointer;
}

.mini-val {
  min-width: 26px;
  text-align: center;
  font-size: 0.78rem;
  font-weight: 700;
}

.del-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--danger);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-box {
  text-align: center;
  padding: 28px 12px;
  font-size: 0.85rem;
  color: var(--text-light);
}

/* Bouton flottant au-dessus de la TabBar */
.floating-cta {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(64px + env(safe-area-inset-bottom));
  padding: 10px 16px;
  background: linear-gradient(to top, var(--bg-color) 75%, transparent);
  z-index: 35;
}

.gemini-btn {
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
  font-size: 0.94rem;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.28);
  cursor: pointer;
}

.gemini-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
  z-index: 60;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.toast-banner.success {
  background-color: var(--success);
}

.toast-banner.error {
  background-color: var(--danger);
}

.weekly-note-box {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.note-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.note-head label {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--primary);
  text-transform: uppercase;
}

.clear-note-btn {
  border: none;
  background: transparent;
  color: var(--text-light);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}

.note-input {
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border-radius: 9px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-main);
  font-size: 0.82rem;
}

.note-input:focus {
  outline: none;
  border-color: var(--primary);
}
</style>
