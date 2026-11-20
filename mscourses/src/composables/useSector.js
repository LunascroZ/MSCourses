import { ref } from 'vue'
import { supabase } from '../supabase.js'

export const SECTORS = [
  { value: 'Thionville/Terville', label: 'Thionville / Terville', short: '57 • Semaine' },
  { value: 'Saint-Amand/Valenciennes', label: 'Saint-Amand / Valenciennes', short: '59 • Week-end' },
]

const activeSector = ref('Thionville/Terville')
const configId = ref(null)
const isUpdatingSector = ref(false)
let initialized = false

export function useSector() {
  const loadSector = async () => {
    const { data, error } = await supabase
      .from('app_config')
      .select('id, active_sector')
      .limit(1)

    if (!error && data && data.length > 0) {
      configId.value = data[0].id
      if (data[0].active_sector) {
        activeSector.value = data[0].active_sector
      }
    } else if (!error) {
      const { data: inserted } = await supabase
        .from('app_config')
        .insert([{ active_sector: activeSector.value, updated_at: new Date().toISOString() }])
        .select('id, active_sector')
        .single()

      if (inserted) {
        configId.value = inserted.id
        activeSector.value = inserted.active_sector
      }
    }
  }

  const setSector = async (newSector) => {
    if (!newSector || newSector === activeSector.value || isUpdatingSector.value) return

    const previous = activeSector.value
    activeSector.value = newSector
    isUpdatingSector.value = true

    try {
      const nowIso = new Date().toISOString()
      if (configId.value) {
        const { error } = await supabase
          .from('app_config')
          .update({ active_sector: newSector, updated_at: nowIso })
          .eq('id', configId.value)

        if (error) throw error
      } else {
        const { data: inserted, error } = await supabase
          .from('app_config')
          .insert([{ active_sector: newSector, updated_at: nowIso }])
          .select('id')
          .single()

        if (error) throw error
        if (inserted) configId.value = inserted.id
      }
    } catch (err) {
      console.error('Erreur mise à jour secteur app_config:', err)
      activeSector.value = previous
    } finally {
      isUpdatingSector.value = false
    }
  }

  if (!initialized) {
    initialized = true
    loadSector()
  }

  return {
    SECTORS,
    activeSector,
    isUpdatingSector,
    loadSector,
    setSector,
  }
}