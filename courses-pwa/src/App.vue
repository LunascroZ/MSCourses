<template>
  <div v-if="authLoading" class="splash-screen">
    <div class="ms-logo">MS</div>
    <p>Chargement de MSCourses...</p>
  </div>

  <Login v-else-if="!session" />

  <div v-else class="app-shell">
    <!-- TopBar mobile compacte sur 1 seule ligne -->
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand-group">
          <div class="ms-logo">MS</div>
          <div class="brand-titles">
            <span class="brand-name">MS<span class="accent">Courses</span></span>
            <span class="brand-sub">📍 {{ activeSector }}</span>
          </div>
        </div>

        <button
          type="button"
          class="theme-toggle"
          @click="toggleTheme"
          :aria-label="isDarkMode ? 'Mode clair' : 'Mode sombre'"
        >
          {{ isDarkMode ? '☀️' : '🌙' }}
        </button>
      </div>
    </header>

    <!-- Zone scrollable fluide -->
    <main class="main-scroll">
      <div class="content-container">
        <router-view />
      </div>
    </main>

    <!-- TabBar basse style app iOS/Android -->
    <nav class="bottom-tabbar">
      <div class="tabbar-inner">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="tab-link"
          :class="{ active: $route.path === item.path }"
        >
          <div class="tab-icon-wrap">
            <component :is="item.icon" :size="20" :stroke-width="$route.path === item.path ? 2.4 : 1.9" />
          </div>
          <span class="tab-label">{{ item.label }}</span>
        </router-link>
      </div>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ClipboardList, ShoppingCart, Package, History, Sparkles } from 'lucide-vue-next'
import { supabase } from './supabase'
import { useTheme } from './composables/useTheme'
import { useSector } from './composables/useSector'
import Login from './views/Login.vue'

const { isDarkMode, toggleTheme } = useTheme()
const { activeSector } = useSector()

const session = ref(null)
const authLoading = ref(true)

const navItems = [
  { path: '/draft', label: 'Brouillon', icon: ClipboardList },
  { path: '/shopping', label: 'En Rayon', icon: ShoppingCart },
  { path: '/stock', label: 'Stock', icon: Package },
  { path: '/history', label: 'Historique', icon: History },
  { path: '/bonus', label: 'Bonus', icon: Sparkles },
]

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  session.value = data.session
  authLoading.value = false

  supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
  })
})
</script>

<style scoped>
.splash-screen {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-light);
  font-size: 0.9rem;
}

.app-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  background-color: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  padding-top: env(safe-area-inset-top);
}

.topbar-inner {
  max-width: 540px;
  margin: 0 auto;
  height: 58px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ms-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background-color: var(--primary);
  color: #ffffff;
  font-weight: 800;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-titles {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.1;
  color: var(--text-main);
}

.brand-name .accent {
  color: var(--primary);
}

.brand-sub {
  font-size: 0.72rem;
  color: var(--text-light);
  margin-top: 2px;
}

.theme-toggle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  cursor: pointer;
}

.main-scroll {
  flex: 1;
  width: 100%;
  padding-bottom: calc(135px + env(safe-area-inset-bottom));
}

.content-container {
  max-width: 540px;
  margin: 0 auto;
  padding: 14px 16px;
}

.bottom-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background-color: var(--nav-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--border-color);
  padding-bottom: env(safe-area-inset-bottom);
}

.tabbar-inner {
  max-width: 540px;
  margin: 0 auto;
  height: 64px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
}

.tab-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--text-light);
  transition: color 0.15s ease;
}

.tab-link.active {
  color: var(--primary);
}

.tab-icon-wrap {
  padding: 3px 12px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-link.active .tab-icon-wrap {
  background-color: var(--primary-soft);
}

.tab-label {
  font-size: 0.68rem;
  font-weight: 600;
}
</style>