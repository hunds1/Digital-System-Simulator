import { apiClient } from './client'
import type {
  HealthcheckResponse,
  SchemaPayload,
  SimulationResult,
  SimulationStartPayload,
  SimulationStartResponse,
} from './schemaTypes'

export const endpoints = {
  getHealthcheck: async () => {
    const response = await apiClient.get<HealthcheckResponse>('/health')
    return response.data
  },
  saveSchema: async (payload: SchemaPayload) => {
    const response = await apiClient.post<SchemaPayload>('/schemas', payload)
    return response.data
  },
  loadSchemas: async () => {
    const response = await apiClient.get<SchemaPayload[]>('/schemas')
    return response.data
  },
  startSimulation: async (payload: SimulationStartPayload) => {
    const response = await apiClient.post<SimulationStartResponse>('/simulations', payload)
    return response.data
  },
  getSimulationResult: async (id: string) => {
    const response = await apiClient.get<SimulationResult>(`/simulations/${id}`)
    return response.data
  },
}
