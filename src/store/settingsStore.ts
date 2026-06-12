import { create } from 'zustand'

type CalculationMode = 'fast' | 'balanced' | 'accurate'

const SETTINGS_STORAGE_KEY = 'settings-v1'

interface SettingsState {
  systemName: string
  calculationMode: CalculationMode
  intensity: number
  setSystemName: (name: string) => void
  setCalculationMode: (mode: CalculationMode) => void
  setIntensity: (value: number) => void
}

const getInitialSettings = (): Omit<SettingsState, 'setSystemName' | 'setCalculationMode' | 'setIntensity'> => {
  if (typeof window === 'undefined') {
    return {
      systemName: '',
      calculationMode: 'balanced',
      intensity: 45,
    }
  }

  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
  if (!raw) {
    return {
      systemName: '',
      calculationMode: 'balanced',
      intensity: 45,
    }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<{
      systemName: string
      calculationMode: CalculationMode
      intensity: number
    }>

    return {
      systemName: parsed.systemName ?? '',
      calculationMode: parsed.calculationMode ?? 'balanced',
      intensity: typeof parsed.intensity === 'number' ? parsed.intensity : 45,
    }
  } catch {
    return {
      systemName: '',
      calculationMode: 'balanced',
      intensity: 45,
    }
  }
}

const persistSettings = (settings: { systemName: string; calculationMode: CalculationMode; intensity: number }) => {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

export const useSettingsStore = create<SettingsState>((set) => {
  const initial = getInitialSettings()

  return {
    ...initial,
    setSystemName: (systemName) =>
      set((state) => {
        const next = { ...state, systemName }
        persistSettings({
          systemName,
          calculationMode: next.calculationMode,
          intensity: next.intensity,
        })
        return next
      }),
    setCalculationMode: (calculationMode) =>
      set((state) => {
        const next = { ...state, calculationMode }
        persistSettings({
          systemName: next.systemName,
          calculationMode,
          intensity: next.intensity,
        })
        return next
      }),
    setIntensity: (intensity) =>
      set((state) => {
        const next = { ...state, intensity }
        persistSettings({
          systemName: next.systemName,
          calculationMode: next.calculationMode,
          intensity,
        })
        return next
      }),
  }
})
