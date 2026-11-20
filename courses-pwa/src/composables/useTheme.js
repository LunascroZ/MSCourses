import { ref, watchEffect } from 'vue'

const isDarkMode = ref(localStorage.getItem('mscourses_theme') === 'dark')

watchEffect(() => {
  localStorage.setItem('mscourses_theme', isDarkMode.value ? 'dark' : 'light')
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark-theme', isDarkMode.value)
  }
})

export function useTheme() {
  const toggleTheme = () => {
    isDarkMode.value = !isDarkMode.value
  }
  return { isDarkMode, toggleTheme }
}