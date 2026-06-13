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

export interface NetworkSchemaPoint {
  id: string
  label: string
  type: 'point' | 'warehouse'
  x: number
  y: number
}

export interface NetworkSchemaEdge {
  source: string
  target: string
  distance: number
}

export interface NetworkSchema {
  points: NetworkSchemaPoint[]
  edges: NetworkSchemaEdge[]
}

export interface SimulationStartPayload {
  mode: 'strict' | 'multiagent'
  parameters: Record<string, unknown>
  network?: NetworkSchema | null
}

export interface SimulationStartResponse {
  id: string
  status: 'queued' | 'running'
  startedAt: string
}

/** Raw heatmap cell as returned by the backend */
export interface HeatmapCellRaw {
  x: number
  y: number
  value: number
}

/** Heatmap cell used by the frontend heatmap grid */
export interface HeatmapCell {
  point: string
  truck: string
  orders: number
}

/**
 * Adapts backend heatmap format `{x, y, value}` to frontend `{point, truck, orders}`.
 * x → point label (e.g. "P-1"), y → truck group label (e.g. "TR-1"), value → orders count.
 */
export function adaptHeatmap(raw: HeatmapCellRaw[], pointLabels?: string[]): HeatmapCell[] {
  return raw.map((cell) => ({
    point: pointLabels?.[cell.x] ?? `P-${cell.x + 1}`,
    truck: `TR-${cell.y + 1}`,
    orders: cell.value,
  }))
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
  /** Raw heatmap from the backend ({x, y, value}). Use adaptHeatmap() to convert. */
  heatmap: HeatmapCellRaw[]
  /** Real point labels from the Constructor network (empty array if no network). */
  pointLabels?: string[]
  createdAt: string
}
