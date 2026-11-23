<template>
  <div class="recipes-page">
    <div class="page-head">
      <h2>Recettes & Idées</h2>
      <button
        type="button"
        class="ai-btn"
        :disabled="isGenerating"
        @click="generateMoreRecipes"
      >
        {{ isGenerating ? '⏳ Génération...' : '✨ +5 Idées IA' }}
      </button>
    </div>

    <!-- Segmented control -->
    <div class="segmented">
      <button
        type="button"
        class="seg-btn"
        :class="{ active: activeTab === 'discover' }"
        @click="activeTab = 'discover'"
      >
        🔥 Découvrir ({{ pendingRecipes.length }})
      </button>
      <button
        type="button"
        class="seg-btn"
        :class="{ active: activeTab === 'liked' }"
        @click="activeTab = 'liked'"
      >
        📖 Mes Recettes ({{ likedRecipes.length }})
      </button>
    </div>

    <!-- ONGLET 1 : DÉCOUVRIR (TINDER) -->
    <div v-if="activeTab === 'discover'" class="discover-wrap">
      <div v-if="currentCard" class="ms-card tinder-card">
        <div class="card-top">
          <span class="cat-badge">{{ currentCard.category || 'Plat' }}</span>
          <span class="time-pill">⏱️ {{ currentCard.prep_time }}</span>
        </div>

        <h3 class="tinder-title">{{ currentCard.title }}</h3>

        <div v-if="currentCard.macros" class="macro-pill">
          {{ currentCard.macros }}
        </div>

        <!-- Résumé corrélation stock -->
        <div class="match-banner" :class="getStockSummary(currentCard).tone">
          <span>{{ getStockSummary(currentCard).label }}</span>
        </div>

        <!-- Aperçu des ingrédients -->
        <div class="ing-preview">
          <div
            v-for="(ing, idx) in analyzeIngredients(currentCard)"
            :key="idx"
            class="ing-line"
          >
            <span class="ing-dot" :class="ing.status"></span>
            <span class="ing-text">
              {{ ing.name }} <strong>({{ ing.quantity }} {{ ing.unit }})</strong>
            </span>
            <span class="ing-state-txt">{{ ing.statusLabel }}</span>
          </div>
        </div>

        <p class="tinder-steps">{{ currentCard.steps }}</p>

        <!-- Boutons Like / Dislike -->
        <div class="tinder-actions">
          <button
            type="button"
            class="swipe-btn dislike"
            @click="voteRecipe(currentCard, 'disliked')"
          >
            ✕ Passer
          </button>
          <button
            type="button"
            class="swipe-btn like"
            @click="voteRecipe(currentCard, 'liked')"
          >
            ♥ J'aime
          </button>
        </div>
      </div>

      <div v-else class="ms-card empty-card">
        <p class="empty-title">Plus aucune recette à trier</p>
        <p class="empty-sub">
          Gemini s'appuiera sur tes {{ likedRecipes.length }} recettes likées et ton stock actuel pour t'en proposer de nouvelles.
        </p>
        <button
          type="button"
          class="ai-btn mt-btn"
          :disabled="isGenerating"
          @click="generateMoreRecipes"
        >
          {{ isGenerating ? '⏳ Génération...' : '✨ Générer 5 nouvelles recettes' }}
        </button>
      </div>
    </div>

    <!-- ONGLET 2 : MES RECETTES LIKÉES -->
    <div v-if="activeTab === 'liked'" class="liked-list">
      <div v-if="likedRecipes.length === 0" class="ms-card empty-card">
        <p class="empty-title">Aucune recette enregistrée</p>
        <p class="empty-sub">Like des idées dans « Découvrir » pour les retrouver ici.</p>
      </div>

      <button
        v-for="recipe in likedRecipes"
        :key="recipe.id"
        type="button"
        class="ms-card liked-row"
        @click="openRecipeDetail(recipe)"
      >
        <div class="liked-top">
          <span class="cat-badge">{{ recipe.category || 'Plat' }}</span>
          <span class="stock-chip" :class="getStockSummary(recipe).tone">
            {{ getStockSummary(recipe).short }}
          </span>
        </div>
        <h3 class="liked-title">{{ recipe.title }}</h3>
        <div class="liked-meta">
          <span>⏱️ {{ recipe.prep_time }}</span>
          <span v-if="recipe.macros">• {{ recipe.macros }}</span>
        </div>
      </button>
    </div>

    <!-- MODALE DÉTAIL RECETTE -->
    <div v-if="selectedRecipe" class="modal-overlay" @click.self="selectedRecipe = null">
      <div class="modal-sheet">
        <div class="modal-head">
          <div>
            <span class="cat-badge">{{ selectedRecipe.category || 'Plat' }}</span>
            <h3>{{ selectedRecipe.title }}</h3>
          </div>
          <button type="button" class="modal-close" @click="selectedRecipe = null">✕</button>
        </div>

        <div class="detail-meta">
          <span class="time-pill">⏱️ {{ selectedRecipe.prep_time }}</span>
          <span v-if="selectedRecipe.macros" class="macro-pill">{{ selectedRecipe.macros }}</span>
        </div>

        <!-- Ingrédients + Corrélation Stock -->
        <div class="detail-section">
          <h4>Ingrédients & Stock</h4>
          <div class="ing-preview">
            <div
              v-for="(ing, idx) in selectedAnalysis"
              :key="idx"
              class="ing-line"
            >
              <span class="ing-dot" :class="ing.status"></span>
              <span class="ing-text">
                {{ ing.name }} <strong>({{ ing.quantity }} {{ ing.unit }})</strong>
              </span>
              <span class="ing-state-txt">{{ ing.statusLabel }}</span>
            </div>
          </div>
        </div>

        <!-- Étapes -->
        <div class="detail-section">
          <h4>Préparation</h4>
          <p class="detail-steps">{{ selectedRecipe.steps }}</p>
        </div>

        <!-- Actions -->
        <div class="detail-actions">
          <button
            v-if="missingForSelected.length > 0"
            type="button"
            class="action-primary"
            :disabled="isActionBusy"
            @click="exportMissingToDraft(selectedRecipe)"
          >
            🛒 Envoyer {{ missingForSelected.length }} manquant(s) au Brouillon
          </button>

          <button
            type="button"
            class="action-success"
            :disabled="isActionBusy"
            @click="cookAndDeductStock(selectedRecipe)"
          >
            👨‍🍳 J'ai cuisiné (Déduire du stock)
          </button>

          <button
            type="button"
            class="action-danger"
            @click="removeLikedRecipe(selectedRecipe)"
          >
            Retirer de mes recettes
          </button>
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
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const recipes = ref([])
const inventory = ref([])
const activeTab = ref('discover')
const isGenerating = ref(false)
const isActionBusy = ref(false)
const selectedRecipe = ref(null)
const toastMsg = ref('')
const toastType = ref('success')

const showToast = (msg, type = 'success') => {
  toastMsg.value = msg
  toastType.value = type
  setTimeout(() => {
    toastMsg.value = ''
  }, 3000)
}

const pendingRecipes = computed(() => recipes.value.filter(r => r.status === 'pending'))
const likedRecipes = computed(() => recipes.value.filter(r => r.status === 'liked'))
const currentCard = computed(() => pendingRecipes.value[0] || null)

const normalize = (str) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

// Convertit g/kg et ml/L pour comparer les quantités proprement
const toBaseQty = (qty, unit) => {
  const n = Number(qty) || 0
  const u = normalize(unit)
  if (u === 'kg') return { val: n * 1000, dim: 'mass' }
  if (u === 'g') return { val: n, dim: 'mass' }
  if (u === 'l') return { val: n * 1000, dim: 'vol' }
  if (u === 'ml') return { val: n, dim: 'vol' }
  return { val: n, dim: 'unit' }
}

const findInventoryMatch = (ingName) => {
  const target = normalize(ingName)
  if (!target) return null
  return (
    inventory.value.find(i => normalize(i.name) === target) ||
    inventory.value.find(i => {
      const inv = normalize(i.name)
      return inv.length >= 3 && (inv.includes(target) || target.includes(inv))
    }) ||
    null
  )
}

const analyzeIngredients = (recipe) => {
  const list = Array.isArray(recipe?.ingredients) ? recipe.ingredients : []
  return list.map(ing => {
    const qty = Number(ing.quantity ?? 1) || 1
    const unit = ing.unit || 'unité(s)'
    const inv = findInventoryMatch(ing.name)

    if (!inv || Number(inv.current_quantity ?? 0) <= 0) {
      return {
        ...ing,
        quantity: qty,
        unit,
        invRow: inv,
        missingQty: qty,
        status: 'missing',
        statusLabel: 'Manquant',
      }
    }

    const need = toBaseQty(qty, unit)
    const have = toBaseQty(inv.current_quantity, inv.unit || 'unité(s)')

    if (need.dim === have.dim) {
      if (have.val >= need.val) {
        return {
          ...ing,
          quantity: qty,
          unit,
          invRow: inv,
          missingQty: 0,
          status: 'ok',
          statusLabel: `En stock (${inv.current_quantity} ${inv.unit || 'u'})`,
        }
      }
      const diffBase = need.val - have.val
      const missingQty =
        normalize(unit) === 'kg' || normalize(unit) === 'l'
          ? Number((diffBase / 1000).toFixed(2))
          : Math.ceil(diffBase)
      return {
        ...ing,
        quantity: qty,
        unit,
        invRow: inv,
        missingQty,
        status: 'partial',
        statusLabel: `Manque ${missingQty} ${unit}`,
      }
    }

    // Unités différentes mais présent en stock
    return {
      ...ing,
      quantity: qty,
      unit,
      invRow: inv,
      missingQty: 0,
      status: 'ok',
      statusLabel: `En stock (${inv.current_quantity} ${inv.unit || 'u'})`,
    }
  })
}

const getStockSummary = (recipe) => {
  const analyzed = analyzeIngredients(recipe)
  const total = analyzed.length
  if (total === 0) return { label: 'Ingrédients non renseignés', short: '—', tone: 'neutral' }
  const okCount = analyzed.filter(a => a.status === 'ok').length
  if (okCount === total) {
    return { label: `🟢 Tous les ingrédients en stock (${okCount}/${total})`, short: `${okCount}/${total} OK`, tone: 'ok' }
  }
  if (okCount > 0) {
    return { label: `🟠 ${okCount}/${total} ingrédients déjà en stock`, short: `${okCount}/${total} en stock`, tone: 'partial' }
  }
  return { label: `🔴 0/${total} ingrédients en stock`, short: `0/${total} en stock`, tone: 'missing' }
}

const selectedAnalysis = computed(() =>
  selectedRecipe.value ? analyzeIngredients(selectedRecipe.value) : []
)

const missingForSelected = computed(() =>
  selectedAnalysis.value.filter(i => i.status !== 'ok')
)

const fetchAll = async () => {
  const [recRes, invRes] = await Promise.all([
    supabase.from('recipes').select('*').order('created_at', { ascending: false }),
    supabase.from('inventory').select('*'),
  ])
  if (!recRes.error && recRes.data) recipes.value = recRes.data
  if (!invRes.error && invRes.data) inventory.value = invRes.data
}

const generateMoreRecipes = async () => {
  if (isGenerating.value) return
  isGenerating.value = true

  try {
    const { data, error } = await supabase.functions.invoke('generate-recipes')
    if (error) {
      let errMsg = error.message
      try {
        const txt = await error.context?.text()
        if (txt) errMsg = JSON.parse(txt).error || txt
      } catch {
        // fallback
      }
      showToast(`Erreur : ${errMsg}`, 'error')
      return
    }

    if (data?.recipes?.length) {
      recipes.value = [...data.recipes, ...recipes.value]
      activeTab.value = 'discover'
      showToast(`${data.recipes.length} nouvelles recettes générées !`)
    }
  } finally {
    isGenerating.value = false
  }
}

const voteRecipe = async (recipe, nextStatus) => {
  recipe.status = nextStatus
  const { error } = await supabase
    .from('recipes')
    .update({ status: nextStatus })
    .eq('id', recipe.id)

  if (error) {
    showToast(`Erreur : ${error.message}`, 'error')
  } else if (nextStatus === 'liked') {
    showToast(`"${recipe.title}" ajoutée à Mes Recettes`)
  }
}

const openRecipeDetail = (recipe) => {
  selectedRecipe.value = recipe
}

const exportMissingToDraft = async (recipe) => {
  if (isActionBusy.value) return
  const missing = analyzeIngredients(recipe).filter(i => i.status !== 'ok')
  if (missing.length === 0) return

  isActionBusy.value = true
  try {
    const { data: existingDrafts } = await supabase.from('draft_list').select('name')
    const existingNames = new Set((existingDrafts || []).map(d => normalize(d.name)))

    const toInsert = missing
      .filter(m => !existingNames.has(normalize(m.name)))
      .map(m => ({
        inventory_id: m.invRow?.id ?? null,
        name: m.name,
        quantity: m.missingQty > 0 ? m.missingQty : m.quantity,
        unit: m.unit || 'unité(s)',
        brand: null,
      }))

    if (toInsert.length === 0) {
      showToast('Les ingrédients manquants sont déjà dans le brouillon')
      return
    }

    const { error } = await supabase.from('draft_list').insert(toInsert)
    if (error) throw error

    showToast(`${toInsert.length} ingrédient(s) envoyé(s) au Brouillon`)
  } catch (err) {
    showToast(`Erreur : ${err?.message || err}`, 'error')
  } finally {
    isActionBusy.value = false
  }
}

const cookAndDeductStock = async (recipe) => {
  if (isActionBusy.value) return
  if (!confirm(`Déduire les ingrédients de "${recipe.title}" de ton stock actuel ?`)) return

  isActionBusy.value = true
  try {
    const analyzed = analyzeIngredients(recipe)
    let updatedCount = 0

    for (const ing of analyzed) {
      if (!ing.invRow) continue
      const need = toBaseQty(ing.quantity, ing.unit)
      const have = toBaseQty(ing.invRow.current_quantity, ing.invRow.unit || 'unité(s)')

      if (need.dim !== have.dim) continue

      const remainingBase = Math.max(0, have.val - need.val)
      const invUnitNorm = normalize(ing.invRow.unit || 'unité(s)')
      const nextQty =
        invUnitNorm === 'kg' || invUnitNorm === 'l'
          ? Number((remainingBase / 1000).toFixed(2))
          : Number(remainingBase.toFixed(2))

      await supabase
        .from('inventory')
        .update({ current_quantity: nextQty, updated_at: new Date().toISOString() })
        .eq('id', ing.invRow.id)

      ing.invRow.current_quantity = nextQty
      updatedCount++
    }

    showToast(`Stock mis à jour (${updatedCount} produit(s) déduit(s))`)
  } catch (err) {
    showToast(`Erreur : ${err?.message || err}`, 'error')
  } finally {
    isActionBusy.value = false
  }
}

const removeLikedRecipe = async (recipe) => {
  await voteRecipe(recipe, 'disliked')
  selectedRecipe.value = null
  showToast('Recette retirée (Gemini ne la reproposera plus)')
}

onMounted(fetchAll)
</script>

<style scoped>
.recipes-page {
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

.ai-btn {
  padding: 8px 14px;
  border-radius: 12px;
  border: none;
  background: var(--cta-gradient);
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
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

.ms-card {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow);
}

/* Carte Tinder */
.tinder-card {
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-top,
.liked-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cat-badge {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 6px;
  background-color: var(--primary-soft);
  color: var(--primary);
}

.time-pill {
  font-size: 0.74rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 8px;
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
}

.tinder-title {
  font-size: 1.2rem;
  font-weight: 800;
  line-height: 1.25;
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

.match-banner {
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 0.78rem;
  font-weight: 700;
}

.match-banner.ok { background-color: rgba(16, 185, 129, 0.14); color: var(--success); }
.match-banner.partial { background-color: rgba(245, 158, 11, 0.14); color: var(--warning); }
.match-banner.missing { background-color: rgba(239, 68, 68, 0.14); color: var(--danger); }

.ing-preview {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px 12px;
  border-radius: 12px;
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
}

.ing-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
}

.ing-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ing-dot.ok { background-color: var(--success); }
.ing-dot.partial { background-color: var(--warning); }
.ing-dot.missing { background-color: var(--danger); }

.ing-text {
  flex: 1;
}

.ing-state-txt {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-light);
}

.tinder-steps {
  font-size: 0.82rem;
  line-height: 1.48;
  color: var(--text-light);
}

.tinder-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 4px;
}

.swipe-btn {
  height: 48px;
  border-radius: 14px;
  border: none;
  font-size: 0.92rem;
  font-weight: 800;
  cursor: pointer;
}

.swipe-btn.dislike {
  background-color: rgba(239, 68, 68, 0.14);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.swipe-btn.like {
  background-color: var(--success);
  color: #ffffff;
}

/* Liste Likées */
.liked-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.liked-row {
  width: 100%;
  text-align: left;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  color: var(--text-main);
}

.liked-title {
  font-size: 0.98rem;
  font-weight: 800;
}

.liked-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.76rem;
  color: var(--text-light);
}

.stock-chip {
  font-size: 0.7rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
}

.stock-chip.ok { background-color: rgba(16, 185, 129, 0.14); color: var(--success); }
.stock-chip.partial { background-color: rgba(245, 158, 11, 0.14); color: var(--warning); }
.stock-chip.missing { background-color: rgba(239, 68, 68, 0.14); color: var(--danger); }

/* Modale Détail */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
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
  max-height: 86dvh;
  overflow-y: auto;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: env(safe-area-inset-bottom);
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.modal-head h3 {
  font-size: 1.08rem;
  font-weight: 800;
  margin-top: 4px;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-main);
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.detail-section h4 {
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-light);
  margin-bottom: 8px;
}

.detail-steps {
  font-size: 0.84rem;
  line-height: 1.5;
  color: var(--text-main);
}

.detail-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-primary,
.action-success,
.action-danger {
  height: 44px;
  border-radius: 12px;
  border: none;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
}

.action-primary { background-color: var(--primary); color: #ffffff; }
.action-success { background-color: var(--success); color: #ffffff; }
.action-danger {
  background-color: transparent;
  border: 1px solid var(--border-color);
  color: var(--danger);
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