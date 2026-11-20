<template>
    <div class="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center px-6">
      <div class="max-w-sm w-full mx-auto bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700/50">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-white tracking-tight">MSCourses</h1>
          <p class="text-slate-400 text-sm mt-2">Accès privé</p>
        </div>
  
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="ton@email.com"
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
  
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">Mot de passe</label>
            <input
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
  
          <p v-if="errorMsg" class="text-red-400 text-sm text-center bg-red-950/50 py-2 rounded-lg border border-red-900/50">
            {{ errorMsg }}
          </p>
  
          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-3.5 rounded-xl font-bold text-white transition-colors mt-2"
          >
            {{ loading ? 'Connexion...' : 'Se connecter' }}
          </button>
        </form>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  import { supabase } from '../supabase'
  
  const email = ref('')
  const password = ref('')
  const loading = ref(false)
  const errorMsg = ref('')
  
  const handleLogin = async () => {
    loading.value = true
    errorMsg.value = ''
  
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })
  
    if (error) {
      errorMsg.value = 'Identifiants incorrects.'
    }
    loading.value = false
  }
  </script>