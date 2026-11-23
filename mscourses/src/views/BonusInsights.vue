<template>
  <div class="recipes-page">
    <div class="page-head">
      <h2>Recettes & Idées</h2>
      <div class="head-actions">
        <button type="button" class="add-manual-btn" @click="openCreateModal">
          + Recette
        </button>
        <button
          type="button"
          class="ai-btn"
          :disabled="isGenerating"
          @click="showGenModal = true"
        >
          {{ isGenerating ? '⏳' : '✨ IA' }}
        </button>
      </div>
    </div>

    <!-- Segmented control 3 onglets -->
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
        📖 Gardées ({{ likedRecipes.length }})
      </button>
      <button
        type="button"
        class="seg-btn"
        :class="{ active: activeTab === 'disliked' }"
        @click="activeTab = 'disliked'"
      >
        ✕ Refusées ({{ dislikedRecipes.length }})
      </button>
    </div>

    <!-- ONGLET 1 : DÉCOUVRIR (TINDER + SWIPE TACTILE) -->
    <div v-if="activeTab === 'discover'" class="discover-wrap">
      <div
        v-if="currentCard"
        class="ms-card tinder-card"
        :class="{ 'is-dragging': isDragging }"
        :style="cardTransformStyle"
        @touchstart.passive="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
      >
        <div
          v-if="swipeX > 30"
          class="swipe-stamp like-stamp"
          :style="{ opacity: Math.min(1, (swipeX - 30) / 70) }"
        >
          ♥ J'AIME
        </div>
        <div
          v-if="swipeX < -30"
          class="swipe-stamp nope-stamp"
          :style="{ opacity: Math.min(1, (-swipeX - 30) / 70) }"
        >
          ✕ PASSER
        </div>

        <div class="card-top">
          <span class="cat-badge">{{ currentCard.category || 'Plat' }}</span>
          <span class="time-pill">⏱️ {{ currentCard.prep_time }}</span>
        </div>

        <h3 class="tinder-title">{{ currentCard.title }}</h3>

        <div v-if="currentCard.macros" class="macro-pill">
          {{ currentCard.macros }}
        </div>

        <p class="tinder-summary">
          {{ currentCard.summary || currentCard.steps }}
        </p>

        <div class="match-banner" :class="getStockSummary(currentCard).tone">
          <span>{{ getStockSummary(currentCard).label }}</span>
        </div>

        <div class="ing-preview">
          <div
            v-for="(ing, idx) in analyzeIngredients(currentCard)"
            :key="idx"
            class="ing-line"
          >
            <span class="ing-dot" :class="ing.status"></span>
            <div class="ing-text-wrap">
              <span class="ing-text">
                {{ ing.name }} <strong>({{ ing.quantity }} {{ ing.unit }})</strong>
              </span>
              <span v-if="ing.note" class="ing-note">{{ ing.note }}</span>
            </div>
            <span class="ing-state-txt">{{ ing.statusLabel }}</span>
          </div>
        </div>

        <div class="tinder-actions">
          <button
            type="button"
            class="swipe-btn dislike"
            @click="triggerButtonVote(currentCard, 'disliked')"
          >
            ✕ Passer
          </button>
          <button
            type="button"
            class="swipe-btn like"
            @click="triggerButtonVote(currentCard, 'liked')"
          >
            ♥ J'aime
          </button>
        </div>

        <p class="swipe-hint">← Glisse à gauche pour passer • à droite pour aimer →</p>
      </div>

      <div v-else class="ms-card empty-card">
        <p class="empty-title">Plus aucune recette à trier</p>
        <p class="empty-sub">
          Choisis ton envie du moment (Salé/Sucré, Gourmande, Fraîche, Rapide...) et génère un nouveau lot d'idées.
        </p>
        <button
          type="button"
          class="ai-btn mt-btn"
          :disabled="isGenerating"
          @click="showGenModal = true"
        >
          {{ isGenerating ? '⏳ Génération...' : '✨ Configurer & Générer' }}
        </button>
      </div>
    </div>

    <!-- ONGLET 2 : RECETTES GARDÉES (RECHERCHE & FILTRES) -->
    <div v-if="activeTab === 'liked'" class="liked-wrap">
      <div class="search-wrap">
        <input
          v-model="likedSearch"
          type="text"
          placeholder="Rechercher une recette ou un ingrédient..."
          class="search-input"
        />
      </div>

      <div class="filter-strip">
        <button
          type="button"
          class="filter-pill"
          :class="{ active: likedFilter === 'ALL' }"
          @click="likedFilter = 'ALL'"
        >
          Toutes ({{ likedRecipes.length }})
        </button>
        <button
          type="button"
          class="filter-pill"
          :class="{ active: likedFilter === 'SALE' }"
          @click="likedFilter = 'SALE'"
        >
          🍽️ Salé
        </button>
        <button
          type="button"
          class="filter-pill"
          :class="{ active: likedFilter === 'SUCRE' }"
          @click="likedFilter = 'SUCRE'"
        >
          🍨 Sucré
        </button>
        <button
          type="button"
          class="filter-pill"
          :class="{ active: likedFilter === 'READY' }"
          @click="likedFilter = 'READY'"
        >
          🟢 100% en stock
        </button>
      </div>

      <div v-if="filteredLikedRecipes.length === 0" class="ms-card empty-card">
        <p class="empty-title">Aucune recette correspondante</p>
        <p class="empty-sub">Ajuste ton filtre ou swipe à droite dans « Découvrir ».</p>
      </div>

      <div class="liked-list">
        <button
          v-for="recipe in filteredLikedRecipes"
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
          <p v-if="recipe.summary" class="liked-summary">{{ recipe.summary }}</p>
          <div class="liked-meta">
            <span>⏱️ {{ recipe.prep_time }}</span>
            <span v-if="recipe.macros">• {{ recipe.macros }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- ONGLET 3 : RECETTES REFUSÉES -->
    <div v-if="activeTab === 'disliked'" class="disliked-wrap">
      <div class="memory-info">
        🧠 Ces {{ dislikedRecipes.length }} recette(s) sont enregistrées en base : Gemini les évite automatiquement lors de ses prochaines générations.
      </div>

      <div v-if="dislikedRecipes.length === 0" class="ms-card empty-card">
        <p class="empty-title">Aucune recette refusée</p>
        <p class="empty-sub">Les recettes que tu passes apparaîtront ici.</p>
      </div>

      <div class="liked-list">
        <div
          v-for="recipe in dislikedRecipes"
          :key="recipe.id"
          class="ms-card disliked-row"
        >
          <div class="disliked-main" @click="openRecipeDetail(recipe)">
            <span class="cat-badge muted">{{ recipe.category || 'Plat' }}</span>
            <h3 class="liked-title">{{ recipe.title }}</h3>
            <span class="disliked-meta">⏱️ {{ recipe.prep_time }}</span>
          </div>
          <button
            type="button"
            class="restore-btn"
            title="Finalement je la garde"
            @click="voteRecipe(recipe, 'liked')"
          >
            ♥ Garder
          </button>
        </div>
      </div>
    </div>

    <!-- MODALE CONFIGURATION GÉNÉRATION IA -->
    <div v-if="showGenModal" class="modal-overlay" @click.self="showGenModal = false">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>✨ Tes envies du moment</h3>
          <button type="button" class="modal-close" @click="showGenModal = false">✕</button>
        </div>

        <div class="gen-group">
          <label>Type</label>
          <div class="chip-grid-3">
            <button
              v-for="t in tasteOptions"
              :key="t.value"
              type="button"
              class="choice-chip"
              :class="{ active: genConfig.taste === t.value }"
              @click="genConfig.taste = t.value"
            >
              {{ t.label }}
            </button>
          </div>
        </div>

        <div class="gen-group">
          <label>Ambiance / Envie</label>
          <div class="chip-grid-2">
            <button
              v-for="v in vibeOptions"
              :key="v.value"
              type="button"
              class="choice-chip"
              :class="{ active: genConfig.vibe === v.value }"
              @click="genConfig.vibe = v.value"
            >
              {{ v.label }}
            </button>
          </div>
        </div>

        <div class="gen-group">
          <label>Nombre de recettes (1 seul appel IA)</label>
          <div class="chip-grid-3">
            <button
              v-for="n in [10, 15, 20]"
              :key="n"
              type="button"
              class="choice-chip"
              :class="{ active: genConfig.count === n }"
              @click="genConfig.count = n"
            >
              {{ n }} recettes
            </button>
          </div>
        </div>

        <button
          type="button"
          class="action-primary"
          :disabled="isGenerating"
          @click="generateMoreRecipes"
        >
          {{ isGenerating ? '⏳ Gemini cuisine tes idées...' : `✨ Générer ${genConfig.count} recettes` }}
        </button>
      </div>
    </div>

    <!-- MODALE DÉTAIL RECETTE -->
    <div v-if="selectedRecipe" class="modal-overlay" @click.self="selectedRecipe = null">
      <div class="modal-sheet">
        <div class="modal-head">
          <div>
            <span class="cat-badge">{{ selectedRecipe.category || 'Plat' }}</span>
            <h3>{{ selectedRecipe.title }}</h3>
          </div>
          <div class="modal-head-btns">
            <button
              type="button"
              class="modal-close"
              title="Modifier cette recette"
              @click="openEditModal(selectedRecipe)"
            >
              ✏️
            </button>
            <button type="button" class="modal-close" @click="selectedRecipe = null">✕</button>
          </div>
        </div>

        <div class="detail-meta">
          <span class="time-pill">⏱️ {{ selectedRecipe.prep_time }}</span>
          <span v-if="selectedRecipe.macros" class="macro-pill">{{ selectedRecipe.macros }}</span>
        </div>

        <div class="detail-section">
          <h4>Ingrédients & Stock</h4>
          <div class="ing-preview">
            <div
              v-for="(ing, idx) in selectedAnalysis"
              :key="idx"
              class="ing-line"
            >
              <span class="ing-dot" :class="ing.status"></span>
              <div class="ing-text-wrap">
                <span class="ing-text">
                  {{ ing.name }} <strong>({{ ing.quantity }} {{ ing.unit }})</strong>
                </span>
                <span v-if="ing.note" class="ing-note">{{ ing.note }}</span>
              </div>
              <span class="ing-state-txt">{{ ing.statusLabel }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>Préparation étape par étape</h4>
          <div class="steps-cards">
            <div
              v-for="(step, idx) in getStructuredSteps(selectedRecipe)"
              :key="idx"
              class="step-card"
            >
              <div class="step-card-head">
                <span class="step-num">{{ String(idx + 1).padStart(2, '0') }}</span>
                <span class="step-title">{{ step.title || `Étape ${idx + 1}` }}</span>
              </div>
              <div v-if="step.duration || step.appliance" class="step-badges">
                <span v-if="step.duration" class="step-badge">⏱️ {{ step.duration }}</span>
                <span v-if="step.appliance" class="step-badge appliance">🔥 {{ step.appliance }}</span>
              </div>
              <p class="step-detail">{{ step.detail }}</p>
            </div>
          </div>
        </div>

        <div class="detail-actions">
          <button
            v-if="selectedRecipe.status === 'disliked'"
            type="button"
            class="action-success"
            @click="restoreFromModal(selectedRecipe)"
          >
            ♥ Récupérer dans Gardées
          </button>

          <template v-else>
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
              Déplacer dans Refusées
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- MODALE CRÉATION / ÉDITION DE RECETTE -->
    <div v-if="showManualModal" class="modal-overlay" @click.self="showManualModal = false">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>{{ editingRecipeId ? '✏️ Modifier la recette' : '📝 Nouvelle recette perso' }}</h3>
          <button type="button" class="modal-close" @click="showManualModal = false">✕</button>
        </div>

        <form class="manual-form" @submit.prevent="saveManualRecipe">
          <div class="field-group">
            <label>Titre de la recette</label>
            <input
              v-model="manualForm.title"
              type="text"
              required
              placeholder="Ex: Tenders maison Airfryer"
              class="modal-input"
            />
          </div>

          <div class="field-row-2">
            <div class="field-group">
              <label>Type</label>
              <select v-model="manualForm.taste" class="modal-input">
                <option value="Salé">🍽️ Salé</option>
                <option value="Sucré">🍨 Sucré</option>
              </select>
            </div>
            <div class="field-group">
              <label>Temps de prépa</label>
              <input v-model="manualForm.prep_time" type="text" placeholder="20 min" class="modal-input" />
            </div>
          </div>

          <div class="field-group">
            <label>Macros par portion (Kcal / Prot / Gluc / Lip)</label>
            <div class="macro-grid-4">
              <input v-model.number="manualForm.kcal" type="number" min="0" placeholder="Kcal" class="modal-input" />
              <input v-model.number="manualForm.protein" type="number" min="0" placeholder="Prot (g)" class="modal-input" />
              <input v-model.number="manualForm.carbs" type="number" min="0" placeholder="Gluc (g)" class="modal-input" />
              <input v-model.number="manualForm.fat" type="number" min="0" placeholder="Lip (g)" class="modal-input" />
            </div>
          </div>

          <div class="field-group">
            <label>Résumé court</label>
            <input
              v-model="manualForm.summary"
              type="text"
              placeholder="Ex: Croustillants aux cornflakes sans huile"
              class="modal-input"
            />
          </div>

          <div class="field-group">
            <div class="sub-head">
              <label>Ingrédients</label>
              <button type="button" class="mini-add-btn" @click="addManualIngredient">+ Ingrédient</button>
            </div>
            <div v-for="(ing, idx) in manualForm.ingredients" :key="idx" class="ing-edit-box">
              <div class="dynamic-row">
                <input v-model="ing.name" type="text" placeholder="Nom (ex: Poulet)" class="modal-input flex-2" />
                <input v-model.number="ing.quantity" type="number" step="any" min="0" placeholder="Qté" class="modal-input w-qty" />
                <select v-model="ing.unit" class="modal-input w-unit">
                  <option v-for="u in manualUnits" :key="u" :value="u">{{ u }}</option>
                </select>
                <button
                  v-if="manualForm.ingredients.length > 1"
                  type="button"
                  class="mini-del-btn"
                  @click="manualForm.ingredients.splice(idx, 1)"
                >
                  ✕
                </button>
              </div>
              <input
                v-model="ing.note"
                type="text"
                placeholder="Précision (ex: surgelées, coupées en dés...)"
                class="modal-input note-input"
              />
            </div>
          </div>

          <div class="field-group">
            <div class="sub-head">
              <label>Étapes</label>
              <button type="button" class="mini-add-btn" @click="addManualStep">+ Étape</button>
            </div>
            <div v-for="(step, idx) in manualForm.steps_detail" :key="idx" class="step-edit-box">
              <div class="field-row-2">
                <input v-model="step.title" type="text" :placeholder="`Titre étape ${idx + 1}`" class="modal-input" />
                <input v-model="step.appliance" type="text" placeholder="Appareil (ex: Airfryer 180°C)" class="modal-input" />
              </div>
              <div class="dynamic-row">
                <input v-model="step.duration" type="text" placeholder="Durée (ex: 12 min)" class="modal-input w-dur" />
                <input v-model="step.detail" type="text" placeholder="Instructions..." class="modal-input flex-2" />
                <button
                  v-if="manualForm.steps_detail.length > 1"
                  type="button"
                  class="mini-del-btn"
                  @click="manualForm.steps_detail.splice(idx, 1)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <button type="submit" class="action-primary" :disabled="isSavingManual">
            {{ isSavingManual ? 'Enregistrement...' : (editingRecipeId ? 'Enregistrer les modifications' : 'Enregistrer dans Gardées') }}
          </button>
        </form>
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
const showGenModal = ref(false)
const likedSearch = ref('')
const likedFilter = ref('ALL')
const toastMsg = ref('')
const toastType = ref('success')

// Modale création / édition manuelle
const showManualModal = ref(false)
const editingRecipeId = ref(null)
const isSavingManual = ref(false)
const manualUnits = ['g', 'kg', 'ml', 'L', 'unité(s)', 'c. à s.', 'c. à c.', 'pincée']

const manualForm = ref({
  title: '',
  taste: 'Salé',
  prep_time: '20 min',
  kcal: null,
  protein: null,
  carbs: null,
  fat: null,
  summary: '',
  ingredients: [{ name: '', quantity: 100, unit: 'g', note: '' }],
  steps_detail: [{ title: 'Préparation', duration: '10 min', appliance: '', detail: '' }],
})

const genConfig = ref({
  taste: 'Salé',
  vibe: 'Gourmande',
  count: 15,
})

const tasteOptions = [
  { value: 'Salé', label: '🍽️ Salé' },
  { value: 'Sucré', label: '🍨 Sucré' },
  { value: 'Mix', label: '🎲 Mix' },
]

const vibeOptions = [
  { value: 'Gourmande', label: '🤤 Gourmande' },
  { value: 'Réconfortante', label: '🍲 Réconfortante' },
  { value: 'Fraîche', label: '🥗 Fraîche' },
  { value: 'Rapide', label: '⚡ Rapide (<15m)' },
  { value: 'Découverte', label: '🌍 Découverte' },
  { value: 'Sèche / Protéinée', label: '💪 Sèche / Protéinée' },
]

// Détection produits binaires / condiments
const CULINARY_UNITS = [
  'c. a s.', 'c.a.s', 'cas', 'cuillere a soupe', 'cuilleres a soupe',
  'c. a c.', 'c.a.c', 'cac', 'cuillere a cafe', 'cuilleres a cafe',
  'pincee', 'pincees', 'trait', 'filet', 'goutte', 'gouttes', 'spray', 'zeste', 'qs',
]

const BINARY_KEYWORDS = [
  'sauce', 'huile', 'vinaigre', 'sel', 'poivre', 'epice', 'paprika', 'curry',
  'cumin', 'herbe', 'origan', 'basilic', 'thym', 'ail en poudre', 'oignon en poudre',
  'moutarde', 'ketchup', 'mayonnaise', 'soja', 'teriyaki', 'chipotle', 'barbecue',
  'bbq', 'sirop', 'arome', 'levure', 'bicarbonate', 'cannelle', 'muscade', 'piment',
  'tabasco', 'sriracha', 'miel', 'confiture', 'beurre',
]

// Swipe tactile
const touchStartX = ref(0)
const touchStartY = ref(0)
const swipeX = ref(0)
const isDragging = ref(false)
const isHorizontalSwipe = ref(null)

const cardTransformStyle = computed(() => {
  const rotate = swipeX.value * 0.045
  return { transform: `translateX(${swipeX.value}px) rotate(${rotate}deg)` }
})

const onTouchStart = (e) => {
  if (!e.touches?.length) return
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
  isDragging.value = true
  isHorizontalSwipe.value = null
}

const onTouchMove = (e) => {
  if (!isDragging.value || !e.touches?.length) return
  const dx = e.touches[0].clientX - touchStartX.value
  const dy = e.touches[0].clientY - touchStartY.value

  if (isHorizontalSwipe.value === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
    isHorizontalSwipe.value = Math.abs(dx) > Math.abs(dy)
  }

  if (isHorizontalSwipe.value) {
    e.preventDefault()
    swipeX.value = dx
  }
}

const onTouchEnd = () => {
  if (!isDragging.value) return
  isDragging.value = false

  const threshold = 95
  if (swipeX.value > threshold && currentCard.value) {
    triggerButtonVote(currentCard.value, 'liked')
  } else if (swipeX.value < -threshold && currentCard.value) {
    triggerButtonVote(currentCard.value, 'disliked')
  } else {
    swipeX.value = 0
  }
}

const triggerButtonVote = (recipe, nextStatus) => {
  swipeX.value = nextStatus === 'liked' ? 360 : -360
  setTimeout(() => {
    swipeX.value = 0
    voteRecipe(recipe, nextStatus)
  }, 180)
}

const showToast = (msg, type = 'success') => {
  toastMsg.value = msg
  toastType.value = type
  setTimeout(() => {
    toastMsg.value = ''
  }, 3000)
}

const pendingRecipes = computed(() => recipes.value.filter(r => r.status === 'pending'))
const likedRecipes = computed(() => recipes.value.filter(r => r.status === 'liked'))
const dislikedRecipes = computed(() => recipes.value.filter(r => r.status === 'disliked'))
const currentCard = computed(() => pendingRecipes.value[0] || null)

const normalize = (str) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const isCulinaryMeasure = (unit) => {
  const u = normalize(unit)
  return CULINARY_UNITS.some(c => u === c || u.includes(c))
}

const isBinaryProduct = (name, unit, invRow) => {
  if (isCulinaryMeasure(unit)) return true
  const n = normalize(name)
  const invUnit = normalize(invRow?.unit || 'unite(s)')
  const isTrackedAsSingleUnit =
    invUnit.startsWith('unite') ||
    invUnit.includes('bouteille') ||
    invUnit.includes('pot') ||
    invUnit.includes('flacon')
  return isTrackedAsSingleUnit && BINARY_KEYWORDS.some(k => n.includes(k))
}

const filteredLikedRecipes = computed(() => {
  const q = normalize(likedSearch.value)
  return likedRecipes.value.filter(r => {
    if (q) {
      const inTitle = normalize(r.title).includes(q)
      const inCat = normalize(r.category).includes(q)
      const inIng = (r.ingredients || []).some(i => normalize(i.name).includes(q))
      if (!inTitle && !inCat && !inIng) return false
    }
    const catNorm = normalize(r.category)
    if (likedFilter.value === 'SALE') return !catNorm.includes('sucre')
    if (likedFilter.value === 'SUCRE') {
      return (
        catNorm.includes('sucre') ||
        catNorm.includes('dessert') ||
        catNorm.includes('collation') ||
        catNorm.includes('petit-dej')
      )
    }
    if (likedFilter.value === 'READY') return getStockSummary(r).tone === 'ok'
    return true
  })
})

const getStructuredSteps = (recipe) => {
  if (Array.isArray(recipe?.steps_detail) && recipe.steps_detail.length > 0) {
    return recipe.steps_detail
  }
  const raw = String(recipe?.steps || '').trim()
  if (!raw) return []
  const chunks = raw
    .split(/\n+|(?<=\.)\s+/)
    .map(s => s.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(Boolean)
  return chunks.map((detail, idx) => ({
    title: `Étape ${idx + 1}`,
    duration: '',
    appliance: '',
    detail,
  }))
}

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
    const binary = isBinaryProduct(ing.name, unit, inv)

    if (binary) {
      if (inv && Number(inv.current_quantity ?? 0) > 0) {
        return {
          ...ing,
          quantity: qty,
          unit,
          invRow: inv,
          missingQty: 0,
          skipDeduct: true,
          status: 'ok',
          statusLabel: 'En stock (binaire)',
        }
      }
      return {
        ...ing,
        quantity: qty,
        unit,
        invRow: inv,
        missingQty: 1,
        exportUnit: 'unité(s)',
        skipDeduct: true,
        status: 'missing',
        statusLabel: 'Manquant',
      }
    }

    if (!inv || Number(inv.current_quantity ?? 0) <= 0) {
      return {
        ...ing,
        quantity: qty,
        unit,
        invRow: inv,
        missingQty: qty,
        skipDeduct: false,
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
          skipDeduct: false,
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
        skipDeduct: false,
        status: 'partial',
        statusLabel: `Manque ${missingQty} ${unit}`,
      }
    }

    return {
      ...ing,
      quantity: qty,
      unit,
      invRow: inv,
      missingQty: 0,
      skipDeduct: true,
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

// Parsing des macros pour pré-remplir le formulaire d'édition
const parseMacrosString = (macrosStr) => {
  const str = String(macrosStr || '')
  const extract = (regex) => {
    const m = str.match(regex)
    return m ? Number(m[1]) : null
  }
  return {
    kcal: extract(/(\d+)\s*kcal/i),
    protein: extract(/(\d+)\s*g?\s*P\b/i),
    carbs: extract(/(\d+)\s*g?\s*G\b/i),
    fat: extract(/(\d+)\s*g?\s*L\b/i),
  }
}

const openCreateModal = () => {
  editingRecipeId.value = null
  manualForm.value = {
    title: '',
    taste: 'Salé',
    prep_time: '20 min',
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
    summary: '',
    ingredients: [{ name: '', quantity: 100, unit: 'g', note: '' }],
    steps_detail: [{ title: 'Préparation', duration: '10 min', appliance: '', detail: '' }],
  }
  showManualModal.value = true
}

const openEditModal = (recipe) => {
  editingRecipeId.value = recipe.id
  const parsedMacros = parseMacrosString(recipe.macros)
  const isSweet = normalize(recipe.category).includes('sucre')
  const existingIngs = Array.isArray(recipe.ingredients) && recipe.ingredients.length
    ? recipe.ingredients.map(i => ({
        name: i.name || '',
        quantity: Number(i.quantity ?? 1) || 1,
        unit: manualUnits.includes(i.unit) ? i.unit : 'unité(s)',
        note: i.note || '',
      }))
    : [{ name: '', quantity: 100, unit: 'g', note: '' }]

  const existingSteps = getStructuredSteps(recipe)
  const formattedSteps = existingSteps.length
    ? existingSteps.map(s => ({
        title: s.title || '',
        duration: s.duration || '',
        appliance: s.appliance || '',
        detail: s.detail || '',
      }))
    : [{ title: 'Préparation', duration: '', appliance: '', detail: '' }]

  manualForm.value = {
    title: recipe.title || '',
    taste: isSweet ? 'Sucré' : 'Salé',
    prep_time: recipe.prep_time || '20 min',
    kcal: parsedMacros.kcal,
    protein: parsedMacros.protein,
    carbs: parsedMacros.carbs,
    fat: parsedMacros.fat,
    summary: recipe.summary || '',
    ingredients: existingIngs,
    steps_detail: formattedSteps,
  }
  selectedRecipe.value = null
  showManualModal.value = true
}

const addManualIngredient = () => {
  manualForm.value.ingredients.push({ name: '', quantity: 1, unit: 'unité(s)', note: '' })
}

const addManualStep = () => {
  manualForm.value.steps_detail.push({
    title: `Étape ${manualForm.value.steps_detail.length + 1}`,
    duration: '',
    appliance: '',
    detail: '',
  })
}

const saveManualRecipe = async () => {
  if (!manualForm.value.title.trim() || isSavingManual.value) return
  isSavingManual.value = true

  try {
    const f = manualForm.value
    const macroParts = []
    if (f.kcal) macroParts.push(`~${f.kcal} kcal`)
    if (f.protein !== null && f.protein !== '') macroParts.push(`${f.protein}g P`)
    if (f.carbs !== null && f.carbs !== '') macroParts.push(`${f.carbs}g G`)
    if (f.fat !== null && f.fat !== '') macroParts.push(`${f.fat}g L`)

    const cleanIngredients = f.ingredients
      .filter(i => i.name.trim())
      .map(i => ({
        name: i.name.trim(),
        quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
        unit: i.unit || 'unité(s)',
        note: i.note?.trim() || '',
      }))

    const cleanSteps = f.steps_detail
      .filter(s => s.detail.trim())
      .map((s, idx) => ({
        title: s.title.trim() || `Étape ${idx + 1}`,
        duration: s.duration.trim(),
        appliance: s.appliance.trim(),
        detail: s.detail.trim(),
      }))

    const stepsText = cleanSteps
      .map((s, idx) => `${idx + 1}. ${s.title} : ${s.detail}`)
      .join('\n')

    const payload = {
      title: f.title.trim(),
      category: `${f.taste} • Perso`,
      prep_time: f.prep_time.trim() || '15 min',
      macros: macroParts.join(' • '),
      summary: f.summary.trim(),
      ingredients: cleanIngredients,
      steps_detail: cleanSteps,
      steps: stepsText || f.summary.trim() || 'Recette personnelle',
    }

    if (editingRecipeId.value) {
      const { data, error } = await supabase
        .from('recipes')
        .update(payload)
        .eq('id', editingRecipeId.value)
        .select()
        .single()

      if (error) throw error
      const idx = recipes.value.findIndex(r => r.id === editingRecipeId.value)
      if (idx !== -1 && data) recipes.value[idx] = data
      showManualModal.value = false
      showToast('Recette mise à jour !')
    } else {
      const { data, error } = await supabase
        .from('recipes')
        .insert([{ ...payload, status: 'liked' }])
        .select()
        .single()

      if (error) throw error
      if (data) recipes.value.unshift(data)
      showManualModal.value = false
      activeTab.value = 'liked'
      showToast(`"${payload.title}" ajoutée à Gardées !`)
    }
  } catch (err) {
    showToast(`Erreur : ${err?.message || err}`, 'error')
  } finally {
    isSavingManual.value = false
  }
}

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
    const { data, error } = await supabase.functions.invoke('generate-recipes', {
      body: {
        taste: genConfig.value.taste,
        vibe: genConfig.value.vibe,
        count: genConfig.value.count,
      },
    })

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
      showGenModal.value = false
      activeTab.value = 'discover'
      showToast(`${data.recipes.length} recettes (${genConfig.value.vibe}) ajoutées !`)
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
    showToast(`"${recipe.title}" ajoutée à Gardées`)
  }
}

const restoreFromModal = async (recipe) => {
  await voteRecipe(recipe, 'liked')
  selectedRecipe.value = null
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
        unit: m.exportUnit || m.unit || 'unité(s)',
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
  if (!confirm(`Déduire les ingrédients principaux de "${recipe.title}" de ton stock actuel ?`)) return

  isActionBusy.value = true
  try {
    const analyzed = analyzeIngredients(recipe)
    let updatedCount = 0

    for (const ing of analyzed) {
      if (!ing.invRow || ing.skipDeduct) continue

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

    showToast(`Stock mis à jour (${updatedCount} produit(s) déduit(s), condiments ignorés)`)
  } catch (err) {
    showToast(`Erreur : ${err?.message || err}`, 'error')
  } finally {
    isActionBusy.value = false
  }
}

const removeLikedRecipe = async (recipe) => {
  await voteRecipe(recipe, 'disliked')
  selectedRecipe.value = null
  showToast('Recette déplacée dans Refusées')
}

onMounted(fetchAll)
</script>

<style scoped>
.recipes-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-x: hidden;
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

.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.add-manual-btn {
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background-color: var(--card-bg);
  color: var(--text-main);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
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
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 4px;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: var(--shadow);
}

.seg-btn {
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-light);
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
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

/* Recherche & Filtres */
.liked-wrap,
.disliked-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.search-input {
  width: 100%;
  height: 42px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background-color: var(--card-bg);
  color: var(--text-main);
  font-size: 0.86rem;
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

/* Carte Tinder */
.tinder-card {
  position: relative;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: transform 0.22s ease;
  touch-action: pan-y;
  user-select: none;
}

.tinder-card.is-dragging { transition: none; }

.swipe-stamp {
  position: absolute;
  top: 22px;
  padding: 6px 14px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 900;
  border: 3px solid;
  z-index: 5;
  pointer-events: none;
}

.like-stamp {
  left: 18px;
  color: var(--success);
  border-color: var(--success);
  background-color: rgba(16, 185, 129, 0.12);
  transform: rotate(-12deg);
}

.nope-stamp {
  right: 18px;
  color: var(--danger);
  border-color: var(--danger);
  background-color: rgba(239, 68, 68, 0.12);
  transform: rotate(12deg);
}

.card-top,
.liked-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cat-badge {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 6px;
  background-color: var(--primary-soft);
  color: var(--primary);
}

.cat-badge.muted {
  background-color: var(--input-bg);
  color: var(--text-light);
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

.tinder-summary {
  font-size: 0.84rem;
  line-height: 1.45;
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
  gap: 9px;
  padding: 12px;
  border-radius: 12px;
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
}

.ing-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.8rem;
}

.ing-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}

.ing-dot.ok { background-color: var(--success); }
.ing-dot.partial { background-color: var(--warning); }
.ing-dot.missing { background-color: var(--danger); }

.ing-text-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ing-note {
  font-size: 0.72rem;
  color: var(--text-light);
  font-style: italic;
}

.ing-state-txt {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-light);
  white-space: nowrap;
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

.swipe-hint {
  text-align: center;
  font-size: 0.7rem;
  color: var(--text-light);
  opacity: 0.75;
}

/* Liste Gardées & Refusées */
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

.liked-summary {
  font-size: 0.78rem;
  color: var(--text-light);
  line-height: 1.38;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.liked-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.74rem;
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

.memory-info {
  font-size: 0.76rem;
  line-height: 1.4;
  padding: 10px 12px;
  border-radius: 12px;
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  color: var(--text-light);
}

.disliked-row {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.disliked-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  cursor: pointer;
}

.disliked-meta {
  font-size: 0.72rem;
  color: var(--text-light);
}

.restore-btn {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(16, 185, 129, 0.4);
  background-color: rgba(16, 185, 129, 0.12);
  color: var(--success);
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
  flex-shrink: 0;
}

/* Cartes d'étapes flottantes */
.steps-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.step-card {
  padding: 12px 14px;
  border-radius: 14px;
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-num {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background-color: var(--primary);
  color: #ffffff;
  font-size: 0.74rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-title {
  font-size: 0.88rem;
  font-weight: 800;
  color: var(--text-main);
}

.step-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.step-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  color: var(--text-light);
}

.step-badge.appliance {
  background-color: var(--primary-soft);
  border-color: transparent;
  color: var(--primary);
}

.step-detail {
  font-size: 0.82rem;
  line-height: 1.48;
  color: var(--text-main);
}

/* Formulaire création / édition */
.manual-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-group label {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-light);
}

.field-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.macro-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.modal-input {
  height: 38px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-main);
  font-size: 0.82rem;
  font-weight: 600;
  width: 100%;
}

.note-input {
  height: 32px;
  font-size: 0.74rem;
  font-weight: 500;
}

.sub-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mini-add-btn {
  padding: 4px 10px;
  border-radius: 8px;
  border: none;
  background-color: var(--primary-soft);
  color: var(--primary);
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
}

.dynamic-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.flex-2 { flex: 2; }
.w-qty { width: 64px; flex-shrink: 0; }
.w-unit { width: 88px; flex-shrink: 0; }
.w-dur { width: 92px; flex-shrink: 0; }

.mini-del-btn {
  width: 30px;
  height: 38px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background-color: rgba(239, 68, 68, 0.12);
  color: var(--danger);
  font-weight: 800;
  cursor: pointer;
  flex-shrink: 0;
}

.ing-edit-box,
.step-edit-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: 12px;
  background-color: var(--surface-elevated);
  border: 1px solid var(--border-color);
}

/* Modales */
.gen-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gen-group label {
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-light);
}

.chip-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.chip-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.choice-chip {
  height: 40px;
  padding: 0 8px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-main);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.choice-chip.active {
  background-color: var(--primary);
  border-color: var(--primary);
  color: #ffffff;
}

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

.modal-head-btns {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
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
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-light);
  margin-bottom: 8px;
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

.mt-btn { margin-top: 14px; }

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