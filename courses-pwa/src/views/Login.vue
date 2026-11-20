<template>
  <div class="login-shell">
    <button
      type="button"
      class="theme-corner"
      @click="toggleTheme"
      :aria-label="isDarkMode ? 'Mode clair' : 'Mode sombre'"
    >
      {{ isDarkMode ? '☀️' : '🌙' }}
    </button>

    <div class="login-card">
      <div class="brand-header">
        <div class="ms-logo-lg">MS</div>
        <h1>MS<span class="accent">Courses</span></h1>
        <p>Optimiseur de courses & gestion de stock</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="field-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            placeholder="matthew@mscorp.fr"
            class="login-input"
          />
        </div>

        <div class="field-group">
          <label for="password">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            placeholder="••••••••"
            class="login-input"
          />
        </div>

        <div v-if="errorMsg" class="error-box">
          {{ errorMsg }}
        </div>

        <button type="submit" class="login-btn" :disabled="isLoading">
          {{ isLoading ? 'Connexion...' : 'Se connecter' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase'
import { useTheme } from '../composables/useTheme'

const { isDarkMode, toggleTheme } = useTheme()

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMsg = ref('')

const handleLogin = async () => {
  if (isLoading.value) return
  isLoading.value = true
  errorMsg.value = ''

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value,
  })

  if (error) {
    errorMsg.value = error.message
  }
  isLoading.value = false
}
</script>

<style scoped>
.login-shell {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: var(--bg-color);
  position: relative;
}

.theme-corner {
  position: absolute;
  top: calc(16px + env(safe-area-inset-top));
  right: 16px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background-color: var(--card-bg);
  font-size: 1.05rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow);
}

.login-card {
  width: 100%;
  max-width: 390px;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 28px 22px;
  box-shadow: var(--shadow);
}

.brand-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 24px;
}

.ms-logo-lg {
  width: 54px;
  height: 54px;
  border-radius: 15px;
  background-color: var(--primary);
  color: #ffffff;
  font-weight: 800;
  font-size: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  box-shadow: 0 6px 18px var(--primary-soft);
}

.brand-header h1 {
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.brand-header .accent {
  color: var(--primary);
}

.brand-header p {
  font-size: 0.8rem;
  color: var(--text-light);
  margin-top: 4px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-group label {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-light);
}

.login-input {
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  font-size: 0.92rem;
}

.login-input:focus {
  outline: none;
  border-color: var(--primary);
}

.error-box {
  padding: 10px 12px;
  border-radius: 10px;
  background-color: rgba(239, 68, 68, 0.14);
  color: var(--danger);
  font-size: 0.78rem;
  font-weight: 600;
  text-align: center;
}

.login-btn {
  height: 48px;
  margin-top: 6px;
  border: none;
  border-radius: 12px;
  background: var(--cta-gradient);
  color: #ffffff;
  font-size: 0.94rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 18px var(--primary-soft);
}

.login-btn:disabled {
  opacity: 0.55;
}
</style>