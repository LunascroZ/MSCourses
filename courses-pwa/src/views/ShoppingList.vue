<template>
  <div class="p-4 pb-28 text-slate-100 min-h-screen bg-slate-900">
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-2xl font-bold">En Rayon</h1>
        <p v-if="brief?.sector" class="text-xs text-slate-400 mt-0.5">
          Secteur : {{ brief.sector }}
          <span v-if="brief.estimated_time"> • {{ brief.estimated_time }}</span>
        </p>
      </div>
      <button
        @click="refreshAll"
        :disabled="isLoading"
        class="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
      >
        {{ isLoading ? 'Actualisation...' : 'Actualiser' }}
      </button>
    </div>

    <div
      v-if="statusMessage"
      class="mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-700 text-emerald-200 text-sm"
    >
      {{ statusMessage }}
    </div>

    <!-- Encadré synthèse & arbitrage logistique -->
    <div
      v-if="brief && (brief.summary || brief.logistics_arbitrage || brief.route_order?.length)"
      class="mb-6 bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs font-semibold uppercase tracking-wider text-blue-400">
          Arbitrage & Tournée
        </span>
        <div class="flex items-center gap-3 text-xs">
          <span v-if="totalPanier > 0" class="bg-slate-900 px-2.5 py-1 rounded-lg font-semibold text-slate-200">
            Total estimé : {{ totalPanier.toFixed(2) }} €
          </span>
          <span v-if="brief.estimated_savings" class="bg-emerald-950/80 border border-emerald-800 px-2.5 py-1 rounded-lg font-semibold text-emerald-300">
            Économie : ~{{ Number(brief.estimated_savings).toFixed(2) }} €
          </span>
        </div>
      </div>

      <p v-if="brief.summary" class="text-sm text-slate-200 leading-relaxed">
        {{ brief.summary }}
      </p>

      <div v-if="brief.logistics_arbitrage" class="text-xs text-slate-300 bg-slate-900/70 p-3 rounded-xl border border-slate-700/70">
        <span class="font-semibold text-blue-300">Pourquoi ces enseignes : </span>
        {{ brief.logistics_arbitrage }}
      </div>

      <div v-if="brief.route_order?.length" class="flex flex-wrap items-center gap-2 pt-1">
        <span class="text-xs text-slate-400 font-medium">Ordre chaîne du froid :</span>
        <span
          v-for="(step, idx) in brief.route_order"
          :key="idx"
          class="text-xs bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-slate-200"
        >
          {{ step }}
        </span>
      </div>

      <div
        v-if="brief.history_alerts?.length"
        class="text-xs text-amber-200 bg-amber-950/50 border border-amber-800/80 p-2.5 rounded-xl space-y-1"
      >
        <p v-for="(alert, i) in brief.history_alerts" :key="i">
          ⚠️ {{ alert }}
        </p>
      </div>
    </div>

    <!-- État vide -->
    <div
      v-if="!isLoading && Object.keys(groupedItems).length === 0"
      class="text-center py-12 text-slate-400 bg-slate-800/50 rounded-2xl border border-slate-800"
    >
      <p class="font-medium text-slate-200 mb-1">Aucun article en rayon pour le moment</p>
      <p class="text-sm">Lance l'optimisation Gemini depuis ton brouillon pour générer le tableau.</p>
    </div>

    <!-- Cartes par enseigne -->
    <div
      v-for="(items, store) in groupedItems"
      :key="store"
      class="mb-8 rounded-2xl border border-slate-700/80 bg-slate-800/40 overflow-hidden"
    >
      <div
        class="px-4 py-3 flex items-center justify-between border-b border-slate-700"
        :style="{ borderLeftWidth: '5px', borderLeftColor: getStoreAccent(store) }"
      >
        <div>
          <h2 class="text-lg font-bold text-white">{{ store }}</h2>
          <p v-if="getStoreRole(store)" class="text-xs text-slate-400">{{ getStoreRole(store) }}</p>
        </div>
        <span class="text-sm font-semibold text-slate-200 bg-slate-900/80 px-3 py-1 rounded-lg">
          {{ getStoreTotal(items).toFixed(2) }} €
        </span>
      </div>

      <div class="divide-y divide-slate-700/60">
        <label
          v-for="item in items"
          :key="item.id"
          class="flex items-start gap-3.5 p-4 bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
          :class="{ 'opacity-50': item.is_checked }"
        >
          <input
            type="checkbox"
            :checked="Boolean(item.is_checked)"
            @change="toggleCheck(item)"
            class="w-6 h-6 mt-1 rounded-lg accent-blue-500 shrink-0"
          />

          <div class="flex-1 min-w-0 space-y-1.5">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <p class="font-bold text-base leading-snug" :class="{ 'line-through': item.is_checked }">
                {{ item.name }}
              </p>
              <div class="text-right shrink-0">
                <span class="font-bold text-blue-300 text-sm">
                  {{ getItemPrice(item) !== null ? `${getItemPrice(item).toFixed(2)} €` : '—' }}
                </span>
                <p class="text-xs text-slate-400">
                  {{ item.quantity ?? 1 }} {{ item.unit || 'unité(s)' }}
                </p>
              </div>
            </div>

            <!-- Fiabilité du prix -->
            <div v-if="item.price_reliability" class="flex items-center gap-2">
              <span
                class="text-[11px] px-2 py-0.5 rounded-md font-medium"
                :class="
                  item.price_reliability.toLowerCase().includes('vérifié')
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/70'
                    : 'bg-amber-950 text-amber-300 border border-amber-800/70'
                "
              >
                {{ item.price_reliability }}
              </span>
            </div>

            <!-- Justification de sélection -->
            <p v-if="item.reason" class="text-xs text-slate-300 leading-relaxed">
              <span class="text-slate-400 font-medium">Pourquoi ce choix : </span>{{ item.reason }}
            </p>

            <!-- Astuce substitution directe -->
            <p
              v-if="item.alternative_tip"
              class="text-xs text-indigo-200 bg-indigo-950/50 border border-indigo-800/60 px-2.5 py-1.5 rounded-lg"
            >
              💡 <span class="font-medium">Alternative :</span> {{ item.alternative_tip }}
            </p>
          </div>
        </label>
      </div>
    </div>

    <!-- Tableau des alternatives & substitutions -->
    <div
      v-if="brief?.alternatives_table?.length"
      class="mt-8 bg-slate-800/70 border border-slate-700 rounded-2xl overflow-hidden"
    >
      <div class="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h2 class="text-base font-bold text-indigo-300">
          Tableau des Alternatives & Substitutions
        </h2>
        <span class="text-xs text-slate-400">MDD • XXL • Macros • En ligne</span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-900/80 text-slate-400 border-b border-slate-700">
              <th class="py-2.5 px-3 font-semibold">Article</th>
              <th class="py-2.5 px-3 font-semibold">Alternative conseillée</th>
              <th class="py-2.5 px-3 font-semibold">Où / Prix</th>
              <th class="py-2.5 px-3 font-semibold">Gain & Intérêt</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-700/60">
            <tr v-for="(alt, idx) in brief.alternatives_table" :key="idx" class="hover:bg-slate-800/80">
              <td class="py-2.5 px-3 font-medium text-slate-200">{{ alt.target_item }}</td>
              <td class="py-2.5 px-3 text-indigo-200 font-medium">{{ alt.alternative_product }}</td>
              <td class="py-2.5 px-3 text-slate-300">
                <div>{{ alt.where_to_find }}</div>
                <div v-if="alt.estimated_price" class="text-emerald-300 font-semibold">
                  {{ alt.estimated_price }}
                </div>
              </td>
              <td class="py-2.5 px-3 text-slate-300">{{ alt.benefit }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <button
      v-if="hasCheckedItems"
      @click="validatePurchases"
      :disabled="isValidating"
      class="fixed bottom-20 left-4 right-4 bg-green-600 hover:bg-green-500 disabled:opacity-60 py-4 rounded-xl font-bold shadow-lg z-10 transition-colors"
    >
      {{ isValidating ? 'Validation en cours...' : `Valider les achats (${checkedItems.length}) • Historique & Stock` }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'

const shoppingList = ref([])
const brief = ref(null)
const isLoading = ref(false)
const isValidating = ref(false)
const statusMessage = ref('')
let realtimeChannel

const STORE_COLORS = {
  leclerc: '#0055a5',
  action: '#38bdf8',
  lidl: '#facc15',
  aldi: '#60a5fa',
  carrefour: '#ef4444',
  'grand frais': '#22c55e',
  asia: '#f87171',
}

const getStoreAccent = (storeName) => {
  const lower = (storeName || '').toLowerCase()
  for (const [key, color] of Object.entries(STORE_COLORS)) {
    if (lower.includes(key)) return color
  }
  return '#64748b'
}

const getStoreRole = (storeName) => {
  if (!brief.value?.stores) return ''
  const match = brief.value.stores.find(
    s => (s.store_name || '').toLowerCase() === (storeName || '').toLowerCase()
  )
  return match?.store_role || ''
}

const groupedItems = computed(() => {
  return shoppingList.value.reduce((acc, item) => {
    const store = item.store || 'À classer'
    if (!acc[store]) acc[store] = []
    acc[store].push(item)
    return acc
  }, {})
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
    await Promise.all([fetchList(), fetchLatestBrief()])
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
  statusMessage.value = ''

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

    // 1. Archivage dans purchase_history avec quantity + unit + purchase_date
    const historyPayload = purchased.map(item => {
      const invRow = resolveInventoryRow(item)
      const qty = Number(item.quantity ?? 1) || 1
      const price = getItemPrice(item) ?? 0
      return {
        inventory_id: item.inventory_id ?? invRow?.id ?? null,
        name: item.name,
        store: item.store || 'Drive',
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

    // 2. Mise à jour de current_quantity et unit dans inventory
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

    // 3. Suppression des articles validés de shopping_list
    const idsToDelete = purchased.map(i => i.id).filter(Boolean)
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('shopping_list')
        .delete()
        .in('id', idsToDelete)

      if (deleteError) throw deleteError
    }

    shoppingList.value = shoppingList.value.filter(i => !Boolean(i.is_checked))
    statusMessage.value = `${purchased.length} article(s) validé(s), archivé(s) dans l'historique et ajouté(s) au stock.`
  } catch (err) {
    console.error('Erreur validation achats:', err)
    statusMessage.value = `Erreur lors de la validation : ${err?.message || err}`
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
</script>