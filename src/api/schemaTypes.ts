export interface HealthcheckResponse {
  status: 'ok' | 'error'
  timestamp: string
}

export interface SchemaPayloadNode {
  id: string
  type: 'point' | 'warehouse' | 'truck'
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface SchemaPayloadEdge {
  id: string
  source: string
  target: string
  type?: string
  data?: Record<string, unknown>
}

export interface SchemaPayload {
  id?: string
  nodes: SchemaPayloadNode[]
  edges: SchemaPayloadEdge[]
  updatedAt?: string
}

export interface SimulationStartPayload {
  mode: 'strict' | 'multiagent'
  parameters: Record<string, unknown>
}

export interface SimulationStartResponse {
  id: string
  status: 'queued' | 'running'
  startedAt: string
}

export interface SimulationResult {
  id: string
  mode: 'strict' | 'multiagent'
  completionPercent: number
  ordersTotal: number
  ordersCompleted: number
  averageTruckLoad: number
  totalCost: number
  simulationSeconds: number
  timeline: Array<{ time: number; completed: number }>
  truckLoadByHour: Array<{ hour: string; load: number }>
  statusDistribution: Array<{ name: string; value: number }>
  comparison: {
    deliveryRate: { strict: number; multiagent: number }
    cost: { strict: number; multiagent: number }
    overloads: { strict: number; multiagent: number }
    trailerSwaps: { strict: number; multiagent: number }
  }
  trucks: Array<{
    id: string
    completedOrders: number
    overloads: number
    trailerSwaps: number
    load: number
    mileage: number
  }>
  heatmap: Array<{ point: string; truck: string; orders: number }>
  createdAt: string
}
