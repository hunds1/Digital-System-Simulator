import type { Edge, Node } from 'reactflow'

export type LogisticsNodeType = 'point' | 'warehouse' | 'truck'

export interface LogisticsNodeData {
  label: string
  subtitle?: string
  status?: 'idle' | 'moving' | 'online' | 'offline'
  orders?: number
  capacity?: number
  queue?: number
  throughput?: number
  load?: number
  trailer?: string
  /** ID узла point или warehouse — цель поездки */
  targetNodeId?: string
  /** Подпись цели для отображения на схеме */
  targetLabel?: string
}

export interface RouteEdgeData {
  distance: string
  routeLoad: number
  isSimulationActive: boolean
}

export type LogisticsNode = Node<LogisticsNodeData>
export type LogisticsEdge = Edge<RouteEdgeData>

export interface LogisticsSchema {
  nodes: LogisticsNode[]
  edges: LogisticsEdge[]
}
