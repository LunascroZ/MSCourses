<template>
  <div class="shopping-page">
    <!-- En-tête & actions rapides -->
    <div class="page-head">
      <div class="head-left">
        <h2>En Rayon</h2>
        <span v-if="brief?.estimated_time" class="time-pill">⏱️ {{ brief.estimated_time }}</span>
      </div>
      <div class="head-actions">
        <button type="button" class="add-inline-btn" @click="openAddModal">
          + Article
        </button>
        <button
          type="button"
          class="refresh-btn"
          :disabled="isLoading"
          @click="refreshAll"
          title="Actualiser"
        >
          {{ isLoading ? '⏳' : '↻' }}
        </button>
      </div>
    </div>

    <!-- Barre de stats -->
    <section v-if="shoppingList.length > 0" class="stats-bar">
      <div class="stat-box">
        <span class="stat-label">Total panier</span>
        <span class="stat-val primary">{{ totalPanier.toFixed(2) }} €</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-box">
        <span class="stat-label">Économie</span>
        <span class="stat-val success">
          {{ brief?.estimated_savings ? `~${Number(brief.estimated_savings).toFixed(2)} €` : '—' }}
        </span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-box">
        <span class="stat-label">Cochés</span>
        <span class="stat-val">{{ checkedItems.length }} / {{ shoppingList.length }}</span>
      </div>
    </section>

    <!-- Encadré Arbitrage & Tournée (dépliable) -->
    <section
      v-if="brief && (brief.summary || brief.logistics_arbitrage || brief.route_order?.length)"
      class="ms-card brief-card"
    >
      <button
        type="button"
        class="brief-toggle"
        @click="showBriefDetails = !showBriefDetails"
      >
        <div class="brief-toggle-left">
          <span class="brief-badge">🧭 Arbitrage & Tournée</span>
          <span v-if="brief.history_alerts?.length" class="alert-dot">
            ⚠️ {{ brief.history_alerts.length }}
          </span>
        </div>
        <span class="chevron">{{ showBriefDetails ? '▲' : '▼' }}</span>
      </button>

      <p v-if="brief.summary" class="brief-summary">
        {{ brief.summary }}
      </p>

      <div v-if="showBriefDetails" class="brief-details">
        <div v-if="brief.logistics_arbitrage" class="logistics-box">
          <strong>Pourquoi ces enseignes :</strong> {{ brief.logistics_arbitrage }}
        </div>

        <div v-if="brief.route_order?.length" class="route-box">
          <span class="route-label">Ordre chaîne du froid :</span>
          <div class="route-steps">
            <span v-for="(step, idx) in brief.route_order" :key="idx" class="route-pill">
              {{ step }}
            </span>
          </div>
        </div>

        <div v-if="brief.history_alerts?.length" class="alerts-box">
          <p v-for="(alert, i) in brief.history_alerts" :key="i">
            ⚠️ {{ alert }}
          </p>
        </div>
      </div>
    </section>

    <!-- Filtres rapides par magasin -->
    <div v-if="storeNames.length > 1" class="store-filters">
      <button
        type="button"
        class="filter-pill"
        :class="{ active: selectedStoreFilter === 'ALL' }"
        @click="selectedStoreFilter = 'ALL'"
      >
        Tous ({{ shoppingList.length }})
      </button>
      <button
        v-for="store in storeNames"
        :key="store"
        type="button"
        class="filter-pill"
        :class="{ active: selectedStoreFilter === store }"
        @click="selectedStoreFilter = store"
      >
        <span class="store-dot" :style="{ backgroundColor: getStoreAccent(store) }"></span>
        {{ store }} ({{ groupedItems[store].length }})
      </button>
    </div>

    <!-- État vide -->
    <div v-if="!isLoading && shoppingList.length === 0" class="ms-card empty-card">
      <p class="empty-title">Aucun article en rayon</p>
      <p class="empty-sub">Lance l'optimisation Gemini depuis Brouillon ou ajoute un article avec « + Article ».</p>
    </div>

    <!-- Cartes par enseigne -->
    <section
      v-for="(items, store) in visibleGroupedItems"
      :key="store"
      class="ms-card store-card"
    >
      <div
        class="store-header"
        :style="{ borderLeftColor: getStoreAccent(store) }"
      >
        <div class="store-title-block">
          <h3>{{ store }}</h3>
          <span v-if="getStoreRole(store)" class="store-role">{{ getStoreRole(store) }}</span>
        </div>
        <span class="store-subtotal">{{ getStoreTotal(items).toFixed(2) }} €</span>
      </div>

      <div class="store-items">
        <div
          v-for="item in items"
          :key="item.id"
          class="shop-row"
          :class="{ checked: Boolean(item.is_checked) }"
          @click="toggleCheck(item)"
        >
          <div class="custom-check" :class="{ active: Boolean(item.is_checked) }">
            <span v-if="item.is_checked">✓</span>
          </div>

          <div class="shop-body">
            <div class="shop-top-line">
              <span class="shop-name">{{ item.name }}</span>
              <div class="shop-right-actions">
                <div class="shop-price-col">
                  <span class="shop-price" :class="{ real: item.actual_price !== null }">
                    {{ getItemPrice(item) !== null ? `${getItemPrice(item).toFixed(2)} €` : '—' }}
                  </span>
                  <span class="shop-qty">
                    {{ item.quantity ?? 1 }} {{ item.unit || 'unité(s)' }}
                  </span>
                </div>
                <button
                  type="button"
                  class="edit-item-btn"
                  title="Modifier nom, prix, quantité ou magasin"
                  @click.stop="openEditModal(item)"
                >
                  ✏️
                </button>
              </div>
            </div>

            <div class="badges-row">
              <span v-if="item.actual_price !== null" class="reliability-badge real-paid">
                Prix réel saisi
              </span>
              <span
                v-else-if="item.price_reliability"
                class="reliability-badge"
                :class="
                  item.price_reliability.toLowerCase().includes('vérifié')
                    ? 'verified'
                    : 'probable'
                "
              >
                {{ item.price_reliability }}
              </span>
            </div>

            <p v-if="item.reason" class="shop-reason">
              {{ item.reason }}
            </p>

            <div v-if="item.alternative_tip" class="shop-alt-tip">
              💡 <strong>Alternative :</strong> {{ item.alternative_tip }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Alternatives & Substitutions -->
    <section
      v-if="brief?.alternatives_table?.length"
      class="ms-card alt-section"
    >
      <div class="alt-header">
        <h3>💡 Alternatives & Substitutions</h3>
        <span class="alt-sub">MDD • XXL • Macros</span>
      </div>

      <div class="alt-list">
        <div v-for="(alt, idx) in brief.alternatives_table" :key="idx" class="alt-item">
          <div class="alt-top">
            <span class="alt-target">{{ alt.target_item }}</span>
            <span v-if="alt.estimated_price" class="alt-price">{{ alt.estimated_price }}</span>
          </div>
          <div class="alt-product">→ {{ alt.alternative_product }}</div>
          <div class="alt-meta">
            <div class="alt-source-line">
              <span class="alt-where">📍 {{ alt.where_to_find }}</span>
              <span
                class="source-tag"
                :class="getSourceClass(alt.price_source)"
              >
                {{ alt.price_source || 'Estimation IA' }}
              </span>
            </div>
            <span class="alt-benefit">{{ alt.benefit }}</span>
          </div>
        </div>
      </div>
    </section>
    <!-- Encadré dépliable : Top Promos Catalogues -->
    <section v-if="topPromos.length > 0" class="ms-card promos-card">
      <button
        type="button"
        class="brief-toggle"
        @click="showPromos = !showPromos"
      >
        <div class="brief-toggle-left">
          <span class="promos-badge">🏷️ Top Promos Catalogues</span>
          <span class="promos-count">{{ topPromos.length }}</span>
        </div>
        <span class="chevron">{{ showPromos ? '▲' : '▼' }}</span>
      </button>

      <div v-if="showPromos" class="promos-list">
        <div
          v-for="(promo, idx) in topPromos"
          :key="idx"
          class="promo-row"
        >
          <div class="promo-info">
            <div class="promo-top">
              <span
                class="promo-store-tag"
                :style="{ backgroundColor: getStoreAccent(promo.store) }"
              >
                {{ promo.store }}
              </span>
              <span v-if="promo.promo_label" class="promo-label-tag">
                {{ promo.promo_label }}
              </span>
            </div>
            <span class="promo-name">{{ promo.product_name }}</span>
            <span class="promo-price">
              {{ Number(promo.price).toFixed(2) }} €
              <small v-if="promo.unit_price">({{ promo.unit_price }})</small>
            </span>
          </div>

          <button
            type="button"
            class="promo-add-btn"
            @click="addPromoToBasket(promo)"
          >
            + Panier
          </button>
        </div>
      </div>
    </section>

    <!-- Bouton flottant de validation des achats -->
    <div v-if="hasCheckedItems" class="floating-validate">
      <button
        type="button"
        class="validate-btn"
        :disabled="isValidating"
        @click="validatePurchases"
      >
        <span v-if="isValidating">⏳ Validation en cours...</span>
        <span v-else>✓ Valider {{ checkedItems.length }} article(s) → Stock & Historique</span>
      </button>
    </div>

    <!-- Modale Édition / Ajout de dernière minute -->
    <div v-if="showItemModal" class="modal-overlay" @click.self="closeItemModal">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>{{ editingItem ? "Ajuster l'achat" : 'Article de dernière minute' }}</h3>
          <button type="button" class="modal-close" @click="closeItemModal">✕</button>
        </div>

        <form class="modal-form" @submit.prevent="saveItemModal">
          <div class="field-group">
            <label>Nom du produit</label>
            <input
              v-model="itemForm.name"
              type="text"
              required
              placeholder="Ex: Skyr nature 1kg"
              class="modal-input"
            />
          </div>

          <div class="field-group">
            <label>Prix réel payé (€)</label>
            <input
              v-model.number="itemForm.actual_price"
              type="number"
              step="0.01"
              min="0"
              inputmode="decimal"
              placeholder="Ex: 3.49 (optionnel)"
              class="modal-input"
            />
          </div>

          <div class="field-row-2">
            <div class="field-group">
              <label>Quantité</label>
              <input
                v-model.number="itemForm.quantity"
                type="number"
                step="any"
                min="0.01"
                inputmode="decimal"
                class="modal-input"
              />
            </div>
            <div class="field-group">
              <label>Unité</label>
              <select v-model="itemForm.unit" class="modal-input">
                <option v-for="u in unitOptions" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
          </div>

          <div class="field-group">
            <label>Magasin</label>
            <select v-model="itemForm.store" class="modal-input">
              <option v-for="st in allowedStores" :key="st" :value="st">{{ st }}</option>
            </select>
          </div>

          <div class="modal-actions">
            <button
              v-if="editingItem"
              type="button"
              class="btn-delete"
              title="Retirer de la liste"
              @click="deleteEditingItem"
            >
              🗑️
            </button>
            <button type="button" class="btn-cancel" @click="closeItemModal">Annuler</button>
            <button
              type="submit"
              class="btn-save"
              :disabled="isSavingModal"
            >
              {{ isSavingModal ? 'Enregistrement...' : (editingItem ? 'Enregistrer' : 'Ajouter') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="statusMessage" class="toast-banner" :class="statusType">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'

const shoppingList = ref([])
const brief = ref(null)
const isLoading = ref(false)
const isValidating = ref(false)
const showBriefDetails = ref(false)
const selectedStoreFilter = ref('ALL')
const statusMessage = ref('')
const statusType = ref('success')

// État modale édition / ajout
const showItemModal = ref(false)
const editingItem = ref(null)
const isSavingModal = ref(false)
const itemForm = ref({
  name: '',
  actual_price: null,
  quantity: 1,
  unit: 'unité(s)',
  store: 'Leclerc',
})

const unitOptions = ['unité(s)', 'g', 'kg', 'L', 'ml', 'lot(s)', 'boîte(s)']
const allowedStores = [
  'Leclerc',
  'Carrefour',
  'Action',
  'Lidl',
  'Aldi',
  'Grand Frais',
  'Auchan',
  'Asia',
  'En ligne',
  'Autre',
]

let realtimeChannel

const STORE_COLORS = {
  leclerc: '#0055a5',
  action: '#0284c7',
  lidl: '#eab308',
  aldi: '#3b82f6',
  carrefour: '#ef4444',
  'grand frais': '#16a34a',
  asia: '#dc2626',
  auchan: '#e11d48',
  'en ligne': '#7c3aed',
}

const showToast = (msg, type = 'success') => {
  statusMessage.value = msg
  statusType.value = type
  setTimeout(() => {
    statusMessage.value = ''
  }, 3200)
}

const getStoreAccent = (storeName) => {
  const lower = (storeName || '').toLowerCase()
  for (const [key, color] of Object.entries(STORE_COLORS)) {
    if (lower.includes(key)) return color
  }
  return '#64748b'
}

const getSourceClass = (source) => {
  const s = (source || '').toLowerCase()
  if (s.includes('drive')) return 'src-verified'
  if (s.includes('catalogue') || s.includes('promo')) return 'src-promo'
  return 'src-estimate'
}

const getStoreRole = (storeName) => {
  if (!brief.value?.stores) return ''
  const match = brief.value.stores.find(
    s => (s.store_name || '').toLowerCase().includes((storeName || '').toLowerCase())
  )
  return match?.store_role || ''
}

const groupedItems = computed(() => {
  return shoppingList.value.reduce((acc, item) => {
    const store = item.store || 'Autre'
    if (!acc[store]) acc[store] = []
    acc[store].push(item)
    return acc
  }, {})
})

const storeNames = computed(() => Object.keys(groupedItems.value))

const visibleGroupedItems = computed(() => {
  if (selectedStoreFilter.value === 'ALL') return groupedItems.value
  const items = groupedItems.value[selectedStoreFilter.value]
  return items ? { [selectedStoreFilter.value]: items } : groupedItems.value
})

const checkedItems = computed(() => shoppingList.value.filter(i => Boolean(i.is_checked)))
const hasCheckedItems = computed(() => checkedItems.value.length > 0)

const getItemPrice = (item) => {
  const val = item.actual_price ?? item.estimated_price
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return Number.isFinite(num) ? num : null
}

const getStoreTotal = (items) => {
  return items.reduce((sum, item) => sum + (getItemPrice(item) ?? 0), 0)
}

const totalPanier = computed(() => getStoreTotal(shoppingList.value))

const openAddModal = () => {
  editingItem.value = null
  const defaultStore =
    selectedStoreFilter.value !== 'ALL' && allowedStores.includes(selectedStoreFilter.value)
      ? selectedStoreFilter.value
      : 'Leclerc'

  itemForm.value = {
    name: '',
    actual_price: null,
    quantity: 1,
    unit: 'unité(s)',
    store: defaultStore,
  }
  showItemModal.value = true
}

const openEditModal = (item) => {
  editingItem.value = item
  itemForm.value = {
    name: item.name || '',
    actual_price: item.actual_price ?? item.estimated_price ?? null,
    quantity: Number(item.quantity ?? 1) || 1,
    unit: item.unit || 'unité(s)',
    store: allowedStores.includes(item.store) ? item.store : 'Autre',
  }
  showItemModal.value = true
}

const closeItemModal = () => {
  showItemModal.value = false
  editingItem.value = null
}

const saveItemModal = async () => {
  if (!itemForm.value.name.trim() || isSavingModal.value) return
  isSavingModal.value = true

  try {
    const rawPrice = itemForm.value.actual_price
    const hasPrice = rawPrice !== null && rawPrice !== '' && Number.isFinite(Number(rawPrice)) && Number(rawPrice) >= 0
    const parsedPrice = hasPrice ? Number(rawPrice) : null
    const parsedQty = Number(itemForm.value.quantity)

    const payload = {
      name: itemForm.value.name.trim(),
      actual_price: parsedPrice,
      quantity: Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1,
      unit: itemForm.value.unit || 'unité(s)',
      store: itemForm.value.store || 'Autre',
    }

    if (editingItem.value) {
      const { error } = await supabase
        .from('shopping_list')
        .update(payload)
        .eq('id', editingItem.value.id)

      if (error) throw error
      Object.assign(editingItem.value, payload)
      showToast('Article mis à jour')
    } else {
      const { data, error } = await supabase
        .from('shopping_list')
        .insert([
          {
            ...payload,
            estimated_price: parsedPrice,
            is_checked: false,
            reason: 'Ajout manuel en rayon',
          },
        ])
        .select()
        .single()

      if (error) throw error
      if (data) shoppingList.value.push(data)
      showToast(`"${payload.name}" ajouté en rayon`)
    }

    closeItemModal()
  } catch (err) {
    console.error('Erreur sauvegarde article:', err)
    showToast(`Erreur : ${err?.message || err}`, 'error')
  } finally {
    isSavingModal.value = false
  }
}

const deleteEditingItem = async () => {
  if (!editingItem.value || !confirm(`Retirer "${editingItem.value.name}" de la liste ?`)) return
  const targetId = editingItem.value.id
  const { error } = await supabase.from('shopping_list').delete().eq('id', targetId)
  if (error) {
    showToast(`Erreur : ${error.message}`, 'error')
    return
  }
  shoppingList.value = shoppingList.value.filter(i => i.id !== targetId)
  closeItemModal()
  showToast('Article retiré')
}

const fetchList = async () => {
  const { data, error } = await supabase
    .from('shopping_list')
    .select('*')
    .order('created_at', { ascending: true })

  if (!error && data) {
    shoppingList.value = data
  }
}

const fetchLatestBrief = async () => {
  const { data, error } = await supabase
    .from('shopping_briefs')
    .select('brief_json')
    .order('created_at', { ascending: false })
    .limit(1)

  if (!error && data && data.length > 0) {
    brief.value = data[0].brief_json
  }
}

const refreshAll = async () => {
  isLoading.value = true
  try {
    await Promise.all([fetchList(), fetchLatestBrief(), fetchTopPromos()])
  } finally {
    isLoading.value = false
  }
}

const toggleCheck = async (item) => {
  const nextState = !Boolean(item.is_checked)
  item.is_checked = nextState

  await supabase
    .from('shopping_list')
    .update({ is_checked: nextState })
    .eq('id', item.id)
}

const validatePurchases = async () => {
  if (!hasCheckedItems.value || isValidating.value) return
  isValidating.value = true

  try {
    const purchased = [...checkedItems.value]
    const nowIso = new Date().toISOString()

    const { data: currentInventory } = await supabase.from('inventory').select('*')
    const invById = new Map((currentInventory || []).map(row => [row.id, row]))
    const invByName = new Map(
      (currentInventory || [])
        .filter(row => row.name)
        .map(row => [row.name.toLowerCase().trim(), row])
    )

    const resolveInventoryRow = (item) => {
      if (item.inventory_id && invById.has(item.inventory_id)) {
        return invById.get(item.inventory_id)
      }
      const key = (item.name || '').toLowerCase().trim()
      return key ? invByName.get(key) : undefined
    }

    const historyPayload = purchased.map(item => {
      const invRow = resolveInventoryRow(item)
      const qty = Number(item.quantity ?? 1) || 1
      const price = getItemPrice(item) ?? 0
      return {
        inventory_id: item.inventory_id ?? invRow?.id ?? null,
        name: item.name,
        store: item.store || 'Autre',
        price,
        quantity: qty,
        unit: item.unit || invRow?.unit || 'unité(s)',
        is_stock_item: Boolean(invRow?.is_stock_item ?? false),
        purchase_date: nowIso,
      }
    })

    const { error: historyError } = await supabase
      .from('purchase_history')
      .insert(historyPayload)

    if (historyError) throw historyError

    for (const item of purchased) {
      const invRow = resolveInventoryRow(item)
      const qtyToAdd = Number(item.quantity ?? 1) || 1
      const itemUnit = item.unit || invRow?.unit || 'unité(s)'

      if (invRow) {
        const currentQty = Number(invRow.current_quantity ?? 0) || 0
        const nextQty = currentQty + qtyToAdd
        await supabase
          .from('inventory')
          .update({
            current_quantity: nextQty,
            unit: itemUnit,
            updated_at: nowIso,
          })
          .eq('id', invRow.id)
        invRow.current_quantity = nextQty
      } else if (item.name?.trim()) {
        const { data: insertedInv } = await supabase
          .from('inventory')
          .insert({
            name: item.name.trim(),
            current_quantity: qtyToAdd,
            unit: itemUnit,
            is_stock_item: false,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select()
          .single()

        if (insertedInv) {
          invById.set(insertedInv.id, insertedInv)
          invByName.set(insertedInv.name.toLowerCase().trim(), insertedInv)
        }
      }
    }

    const idsToDelete = purchased.map(i => i.id).filter(Boolean)
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('shopping_list')
        .delete()
        .in('id', idsToDelete)

      if (deleteError) throw deleteError
    }

    shoppingList.value = shoppingList.value.filter(i => !Boolean(i.is_checked))
    showToast(`${purchased.length} article(s) validé(s) → Historique & Stock`)
  } catch (err) {
    console.error('Erreur validation achats:', err)
    showToast(`Erreur : ${err?.message || err}`, 'error')
  } finally {
    isValidating.value = false
  }
}

const setupRealtime = () => {
  realtimeChannel = supabase
    .channel('shopping_list_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list' }, payload => {
      if (payload.eventType === 'UPDATE') {
        const index = shoppingList.value.findIndex(i => i.id === payload.new.id)
        if (index !== -1) shoppingList.value[index] = payload.new
      } else {
        fetchList()
      }
    })
    .subscribe()
}

onMounted(() => {
  refreshAll()
  setupRealtime()
})

onUnmounted(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})

const topPromos = ref([])
const showPromos = ref(false)

// Score les promos pour faire remonter les meilleurs deals (gros rabais + produits utiles)
const scorePromo = (p) => {
  const text = `${p.product_name || ''} ${p.promo_label || ''}`.toLowerCase()
  let score = 0

  // Gros pourcentages ou offres lots
  if (/(1\s*\+\s*1|2\s*\+\s*1|gratuit|-50%|-60%|-70%|2ème.*-68%|2ème.*-70%)/i.test(text)) score += 50
  else if (/(-30%|-34%|-40%|2ème.*-50%)/i.test(text)) score += 30
  else if (p.promo_label) score += 10

  // Produits piliers (protéines, féculents, café, entretien)
  if (/(poulet|dinde|boeuf|steak|haché|saumon|thon|oeuf|skyr|fromage blanc|whey|riz|pâtes|café|grain|lessive|essuie)/i.test(text)) {
    score += 25
  }

  return score
}

const fetchTopPromos = async () => {
  const { data: configRows } = await supabase
    .from('app_config')
    .select('active_sector')
    .limit(1)

  const activeSector = configRows?.[0]?.active_sector || 'Thionville/Terville'

  const { data, error } = await supabase
    .from('store_prices')
    .select('store, product_name, price, unit_price, promo_label')
    .eq('sector', activeSector)
    .eq('search_term', 'promo_catalogue')
    .gt('price', 0)
    .limit(80)

  if (!error && data) {
    // Dédoublonne par produit+magasin, trie par pertinence et garde le Top 12
    const seen = new Set()
    topPromos.value = data
      .filter(p => {
        const key = `${(p.store || '').toLowerCase()}__${(p.product_name || '').toLowerCase()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => scorePromo(b) - scorePromo(a) || Number(a.price) - Number(b.price))
      .slice(0, 12)
  }
}

const addPromoToBasket = async (promo) => {
  const normalizedStore = allowedStores.find(
    s => s.toLowerCase() === (promo.store || '').toLowerCase()
  ) || 'Autre'

  const { data, error } = await supabase
    .from('shopping_list')
    .insert([
      {
        name: promo.product_name,
        quantity: 1,
        unit: 'unité(s)',
        store: normalizedStore,
        estimated_price: Number(promo.price),
        actual_price: Number(promo.price),
        is_checked: false,
        price_reliability: 'Promo catalogue',
        reason: promo.promo_label || 'Bonne affaire catalogue',
      },
    ])
    .select()
    .single()

  if (error) {
    showToast(`Erreur : ${error.message}`, 'error')
    return
  }

  if (data) shoppingList.value.push(data)
  showToast(`"${promo.product_name}" ajouté dans ${normalizedStore}`)
}
</script>

<style scoped>
.shopping-page {
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

.head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.head-left h2 {
  font-size: 1.2rem;
  font-weight: 800;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.add-inline-btn {
  padding: 6px 12px;
  border-radius: 10px;
  border: none;
  background-color: var(--primary);
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.time-pill {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  color: var(--text-light);
}

.refresh-btn {
  width: 34px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background-color: var(--card-bg);
  color: var(--text-main);
  font-size: 0.88rem;
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
  font-size: 0.98rem;
  font-weight: 800;
  color: var(--text-main);
}

.stat-val.primary { color: var(--primary); }
.stat-val.success { color: var(--success); }

.stat-sep {
  width: 1px;
  height: 28px;
  background-color: var(--border-color);
}

.ms-card {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.brief-card {
  padding: 14px;
}

.brief-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}

.brief-toggle-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brief-badge {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.alert-dot {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  background-color: rgba(245, 158, 11, 0.15);
  color: var(--warning);
}

.chevron {
  font-size: 0.72rem;
  color: var(--text-light);
}

.brief-summary {
  margin-top: 8px;
  font-size: 0.84rem;
  line-height: 1.45;
  color: var(--text-main);
}

.brief-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.logistics-box {
  font-size: 0.78rem;
  line-height: 1.45;
  padding: 10px 12px;
  border-radius: 10px;
  background-color: var(--input-bg);
  color: var(--text-main);
}

.route-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-light);
  margin-bottom: 6px;
}

.route-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.route-pill {
  font-size: 0.74rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 8px;
  background-color: var(--primary-soft);
  color: var(--primary);
}

.alerts-box {
  font-size: 0.76rem;
  padding: 10px 12px;
  border-radius: 10px;
  background-color: rgba(245, 158, 11, 0.14);
  color: var(--warning);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.store-filters {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.store-filters::-webkit-scrollbar {
  display: none;
}

.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background-color: var(--card-bg);
  color: var(--text-light);
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.filter-pill.active {
  background-color: var(--primary);
  border-color: var(--primary);
  color: #ffffff;
}

.store-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.store-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
  border-left: 5px solid var(--primary);
  background-color: var(--surface-elevated);
}

.store-title-block h3 {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-main);
}

.store-role {
  display: block;
  font-size: 0.72rem;
  color: var(--text-light);
  margin-top: 2px;
}

.store-subtotal {
  font-size: 0.88rem;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 8px;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  color: var(--text-main);
}

.store-items {
  display: flex;
  flex-direction: column;
}

.shop-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 13px 14px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.shop-row:last-child {
  border-bottom: none;
}

.shop-row.checked {
  opacity: 0.5;
}

.custom-check {
  width: 24px;
  height: 24px;
  margin-top: 2px;
  border-radius: 7px;
  border: 2px solid var(--border-color);
  background-color: var(--input-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 800;
  color: #ffffff;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.custom-check.active {
  background-color: var(--success);
  border-color: var(--success);
}

.shop-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shop-top-line {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.shop-name {
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-main);
}

.shop-row.checked .shop-name {
  text-decoration: line-through;
}

.shop-right-actions {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-shrink: 0;
}

.shop-price-col {
  text-align: right;
}

.shop-price {
  display: block;
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--primary);
}

.shop-price.real {
  color: var(--success);
}

.shop-qty {
  display: block;
  font-size: 0.72rem;
  color: var(--text-light);
}

.edit-item-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  cursor: pointer;
}

.badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.reliability-badge {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
}

.reliability-badge.verified,
.reliability-badge.real-paid {
  background-color: rgba(16, 185, 129, 0.14);
  color: var(--success);
}

.reliability-badge.probable {
  background-color: rgba(245, 158, 11, 0.14);
  color: var(--warning);
}

.shop-reason {
  font-size: 0.78rem;
  line-height: 1.4;
  color: var(--text-light);
}

.shop-alt-tip {
  font-size: 0.76rem;
  line-height: 1.35;
  padding: 7px 10px;
  border-radius: 8px;
  background-color: var(--primary-soft);
  color: var(--text-main);
}

/* Section Alternatives */
.alt-section {
  padding: 14px;
}

.alt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.alt-header h3 {
  font-size: 0.95rem;
  font-weight: 800;
}

.alt-sub {
  font-size: 0.7rem;
  color: var(--text-light);
  font-weight: 600;
}

.alt-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alt-item {
  padding: 10px 12px;
  border-radius: 12px;
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.alt-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.alt-target {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-light);
}

.alt-price {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--success);
}

.alt-product {
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--text-main);
}

.alt-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.74rem;
  color: var(--text-light);
}

.alt-source-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
}

.alt-where {
  font-weight: 600;
  color: var(--primary);
}

.source-tag {
  font-size: 0.66rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
}

.source-tag.src-verified {
  background-color: rgba(16, 185, 129, 0.14);
  color: var(--success);
}

.source-tag.src-promo {
  background-color: var(--primary-soft);
  color: var(--primary);
}

.source-tag.src-estimate {
  background-color: rgba(245, 158, 11, 0.15);
  color: var(--warning);
}

/* Modale édition / ajout */
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
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
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
  cursor: pointer;
  font-weight: 700;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-group label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-light);
}

.field-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.modal-input {
  height: 42px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-main);
  font-size: 0.9rem;
  font-weight: 600;
  width: 100%;
}

.modal-input:focus {
  outline: none;
  border-color: var(--primary);
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
  font-size: 0.95rem;
  margin-bottom: 4px;
}

.empty-sub {
  font-size: 0.8rem;
  color: var(--text-light);
}

.floating-validate {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(64px + env(safe-area-inset-bottom));
  padding: 10px 16px;
  background: linear-gradient(to top, var(--bg-color) 75%, transparent);
  z-index: 35;
}

.validate-btn {
  max-width: 508px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  border: none;
  border-radius: 14px;
  background-color: var(--success);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.92rem;
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);
  cursor: pointer;
}

.validate-btn:disabled {
  opacity: 0.55;
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
.promos-card {
  padding: 14px;
}

.promos-badge {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--warning);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.promos-count {
  font-size: 0.7rem;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 999px;
  background-color: rgba(245, 158, 11, 0.15);
  color: var(--warning);
}

.promos-list {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.promo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
}

.promo-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.promo-top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.promo-store-tag {
  font-size: 0.64rem;
  font-weight: 800;
  color: #ffffff;
  padding: 2px 7px;
  border-radius: 6px;
}

.promo-label-tag {
  font-size: 0.66rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
  background-color: rgba(245, 158, 11, 0.16);
  color: var(--warning);
}

.promo-name {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.3;
}

.promo-price {
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--success);
}

.promo-price small {
  font-weight: 600;
  color: var(--text-light);
  margin-left: 4px;
}

.promo-add-btn {
  padding: 7px 11px;
  border-radius: 9px;
  border: none;
  background-color: var(--primary);
  color: #ffffff;
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
}

.toast-banner.success { background-color: var(--success); }
.toast-banner.error { background-color: var(--danger); }
</style>