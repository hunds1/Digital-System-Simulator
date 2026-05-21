import { create } from 'zustand'
import type { SimulationResult } from '../api/schemaTypes'

interface SimulationHistoryItem {
  id: string
  date: string
  mode: 'strict' | 'multiagent'
  completionPercent: number
  miniSeries: number[]
  result: SimulationResult
}

interface SimulationRunState {
  selectedParameters: Record<string, unknown>
  history: SimulationHistoryItem[]
  setSelectedParameters: (parameters: Record<string, unknown>) => void
  addHistoryItem: (item: SimulationHistoryItem) => void
}

export const useSimulationRunStore = create<SimulationRunState>((set) => ({
  selectedParameters: {},
  history: [],
  setSelectedParameters: (parameters) => set({ selectedParameters: parameters }),
  addHistoryItem: (item) =>
    set((state) => ({
      history: [item, ...state.history].slice(0, 20),
    })),
}))
