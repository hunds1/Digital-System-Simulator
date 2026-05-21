import type { DragEvent, MouseEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { endpoints } from '../../api/endpoints'
import { useToast } from '../../components/ui'
import { CanvasToolbar } from './components/CanvasToolbar'
import { ElementsSidebar } from './components/ElementsSidebar'
import { PropertiesPanel } from './components/PropertiesPanel'
import { RouteEdge } from './edges/RouteEdge'
import { TruckGuidanceEdge } from './edges/TruckGuidanceEdge'
import { easeOutCubic, lerpPosition, TRUCK_TRAVEL_MS, type FlowPosition } from './utils/truckAnimation'
import { PointNode } from './nodes/PointNode'
import { TruckNode } from './nodes/TruckNode'
import { WarehouseNode } from './nodes/WarehouseNode'
import type { LogisticsEdge, LogisticsNode, LogisticsNodeData, LogisticsNodeType } from './types'

interface Snapshot {
  nodes: Node<LogisticsNodeData>[]
  edges: LogisticsEdge[]
}

const initialNodes: LogisticsNode[] = [
  {
    id: 'point-1',
    type: 'point',
    position: { x: 220, y: 120 },
    data: { label: 'P-01', subtitle: 'Северный район', orders: 14, queue: 6, status: 'online' },
  },
  {
    id: 'warehouse-1',
    type: 'warehouse',
    position: { x: 520, y: 200 },
    data: { label: 'Склад А', capacity: 120, throughput: 55 },
  },
  {
    id: 'point-2',
    type: 'point',
    position: { x: 830, y: 120 },
    data: { label: 'P-02', subtitle: 'Южный район', orders: 9, queue: 4, status: 'online' },
  },
  {
    id: 'truck-1',
    type: 'truck',
    position: { x: 520, y: 380 },
    data: { label: 'TR-7', status: 'idle', load: 68, capacity: 32, trailer: 'T-19' },
  },
]

const initialEdges: LogisticsEdge[] = [
  {
    id: 'route-1',
    source: 'point-1',
    target: 'warehouse-1',
    type: 'route',
    data: { distance: '18 км', routeLoad: 62, isSimulationActive: true },
  },
  {
    id: 'route-2',
    source: 'warehouse-1',
    target: 'point-2',
    type: 'route',
    data: { distance: '24 км', routeLoad: 42, isSimulationActive: true },
  },
]

const nodeTypes = { point: PointNode, warehouse: WarehouseNode, truck: TruckNode }
const edgeTypes = { route: RouteEdge, truckGuidance: TruckGuidanceEdge }

const isValidRoute = (sourceType?: string, targetType?: string) => {
  if (!sourceType || !targetType) return false
  return (
    (sourceType === 'point' && targetType === 'warehouse') ||
    (sourceType === 'warehouse' && targetType === 'point')
  )
}

const ConstructorCanvas = () => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<LogisticsNodeData>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<LogisticsNode | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<LogisticsEdge | null>(null)
  const [draft, setDraft] = useState<LogisticsNodeData>({ label: '' })
  const [undoStack, setUndoStack] = useState<Snapshot[]>([])
  const [redoStack, setRedoStack] = useState<Snapshot[]>([])
  const [isSimulationActive] = useState(true)
  const nodeCountRef = useRef(5)
  const [animatingTruckId, setAnimatingTruckId] = useState<string | null>(null)
  const stopTruckAnimationRef = useRef(false)
  const truckAnimationFrameRef = useRef<number | null>(null)
  const { showToast } = useToast()
  const reactFlow = useReactFlow()

  const cancelTruckAnimation = useCallback(() => {
    stopTruckAnimationRef.current = true
    if (truckAnimationFrameRef.current !== null) {
      cancelAnimationFrame(truckAnimationFrameRef.current)
      truckAnimationFrameRef.current = null
    }
    setAnimatingTruckId(null)
  }, [])

  useEffect(() => () => cancelTruckAnimation(), [cancelTruckAnimation])

  const pushSnapshot = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-29), { nodes, edges }])
    setRedoStack([])
  }, [nodes, edges])

  const updateEdgeSimulationFlag = useCallback(
    (next: Edge[]) =>
      next.map((edge) => ({
        ...edge,
        data: {
          ...(edge.data ?? {}),
          isSimulationActive,
        },
      })),
    [isSimulationActive],
  )

  const validateConnection = useCallback(
    (connection: Connection) => {
      const source = nodes.find((node) => node.id === connection.source)
      const target = nodes.find((node) => node.id === connection.target)
      return isValidRoute(source?.type, target?.type)
    },
    [nodes],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      const source = nodes.find((node) => node.id === connection.source)
      const target = nodes.find((node) => node.id === connection.target)

      if (!isValidRoute(source?.type, target?.type)) {
        showToast({
          variant: 'error',
          title: 'Невалидное соединение',
          description: 'Разрешены только Point ↔ Warehouse.',
        })
        return
      }

      pushSnapshot()
      setEdges((current) =>
        updateEdgeSimulationFlag(
          addEdge(
            {
              ...connection,
              id: `route-${Date.now()}`,
              type: 'route',
              data: {
                distance: `${Math.ceil(Math.random() * 30)} км`,
                routeLoad: Math.ceil(Math.random() * 100),
                isSimulationActive,
              },
            },
            current,
          ) as LogisticsEdge[],
        ),
      )
      showToast({ variant: 'success', title: 'Маршрут добавлен' })
    },
    [nodes, pushSnapshot, setEdges, showToast, updateEdgeSimulationFlag, isSimulationActive],
  )

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const nodeType = event.dataTransfer.getData('application/reactflow') as LogisticsNodeType
      if (!nodeType || !wrapperRef.current) return

      const bounds = wrapperRef.current.getBoundingClientRect()
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })

      const id = `${nodeType}-${nodeCountRef.current++}`
      const newNode: LogisticsNode = {
        id,
        type: nodeType,
        position,
        data:
          nodeType === 'point'
            ? { label: id.toUpperCase(), subtitle: 'Новый пункт', orders: 0, queue: 0 }
            : nodeType === 'warehouse'
              ? { label: `Склад ${id.slice(-1)}`, capacity: 80, throughput: 30 }
              : { label: id.toUpperCase(), status: 'idle', load: 20, capacity: 20, trailer: 'none' },
      }

      pushSnapshot()
      setNodes((current) => [...current, newNode])
      showToast({ variant: 'info', title: 'Элемент добавлен на холст' })
    },
    [pushSnapshot, reactFlow, setNodes, showToast],
  )

  const onDragStart = useCallback((event: DragEvent<HTMLButtonElement>, nodeType: LogisticsNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const onNodeClick = useCallback((_: MouseEvent, node: Node<LogisticsNodeData>) => {
    setSelectedEdge(null)
    setSelectedNode(node as LogisticsNode)
    setDraft(node.data)
  }, [])

  const onEdgeClick = useCallback((_: MouseEvent, edge: Edge) => {
    setSelectedNode(null)
    setSelectedEdge(edge as LogisticsEdge)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
  }, [])

  const handleApply = useCallback(() => {
    if (!selectedNode) return
    pushSnapshot()
    setNodes((current) => current.map((node) => (node.id === selectedNode.id ? { ...node, data: { ...node.data, ...draft } } : node)))
    setSelectedNode(null)
    showToast({ variant: 'success', title: 'Изменения применены' })
  }, [draft, pushSnapshot, selectedNode, setNodes, showToast])

  const handleCancel = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
  }, [])

  const handleDelete = useCallback(() => {
    pushSnapshot()
    if (selectedNode) {
      setNodes((current) => current.filter((node) => node.id !== selectedNode.id))
      setEdges((current) => current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id))
    }
    if (selectedEdge) {
      setEdges((current) => current.filter((edge) => edge.id !== selectedEdge.id))
    }
    setSelectedNode(null)
    setSelectedEdge(null)
  }, [pushSnapshot, selectedEdge, selectedNode, setEdges, setNodes])

  const handleUndo = useCallback(() => {
    setUndoStack((currentUndo) => {
      if (!currentUndo.length) return currentUndo
      const previous = currentUndo[currentUndo.length - 1]
      setRedoStack((currentRedo) => [...currentRedo, { nodes, edges }])
      setNodes(previous.nodes)
      setEdges(previous.edges)
      return currentUndo.slice(0, -1)
    })
  }, [edges, nodes, setEdges, setNodes])

  const handleRedo = useCallback(() => {
    setRedoStack((currentRedo) => {
      if (!currentRedo.length) return currentRedo
      const next = currentRedo[currentRedo.length - 1]
      setUndoStack((currentUndo) => [...currentUndo, { nodes, edges }])
      setNodes(next.nodes)
      setEdges(next.edges)
      return currentRedo.slice(0, -1)
    })
  }, [edges, nodes, setEdges, setNodes])

  const saveSchema = useCallback(async () => {
    try {
      await endpoints.saveSchema({
        nodes: nodes.map((node) => ({
          id: node.id,
          type: (node.type as LogisticsNodeType) ?? 'point',
          position: node.position,
          data: node.data as unknown as Record<string, unknown>,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          data: (edge.data ?? {}) as Record<string, unknown>,
        })),
      })
      showToast({ variant: 'success', title: 'Схема сохранена' })
    } catch {
      localStorage.setItem('logistics-schema', JSON.stringify({ nodes, edges }))
      showToast({
        variant: 'warning',
        title: 'API недоступен',
        description: 'Схема сохранена локально в браузере.',
      })
    }
  }, [edges, nodes, showToast])

  const loadSchema = useCallback(async () => {
    try {
      const payload = await endpoints.loadSchemas()
      const latest = payload[0]
      if (!latest) throw new Error('empty')
      pushSnapshot()
      setNodes(
        latest.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
            data: node.data as unknown as LogisticsNodeData,
        })),
      )
      setEdges(
        updateEdgeSimulationFlag(
          latest.edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type ?? 'route',
            data: (edge.data ?? {}) as unknown as LogisticsEdge['data'],
          })),
        ),
      )
      showToast({ variant: 'success', title: 'Схема загружена из API' })
      return
    } catch {
      const raw = localStorage.getItem('logistics-schema')
      if (!raw) {
        showToast({ variant: 'error', title: 'Нет сохраненной схемы' })
        return
      }
      const local = JSON.parse(raw) as Snapshot
      pushSnapshot()
      setNodes(local.nodes)
      setEdges(updateEdgeSimulationFlag(local.edges))
      showToast({ variant: 'info', title: 'Схема загружена из localStorage' })
    }
  }, [pushSnapshot, setEdges, setNodes, showToast, updateEdgeSimulationFlag])

  const resolveTruckDestination = useCallback(
    (truck: LogisticsNode) => {
      const useDraft = selectedNode?.id === truck.id
      const targetNodeId = useDraft ? draft.targetNodeId ?? truck.data.targetNodeId : truck.data.targetNodeId
      const targetLabel = useDraft ? draft.targetLabel ?? truck.data.targetLabel : truck.data.targetLabel
      return { targetNodeId, targetLabel }
    },
    [draft.targetLabel, draft.targetNodeId, selectedNode?.id],
  )

  const displayEdges = useMemo(() => {
    const guidanceEdges = nodes.flatMap((node) => {
      if (node.type !== 'truck') return []
      const { targetNodeId, targetLabel } = resolveTruckDestination(node)
      if (!targetNodeId) return []
      return [
        {
          id: `guidance-${node.id}`,
          source: node.id,
          target: targetNodeId,
          type: 'truckGuidance',
          selectable: false,
          focusable: false,
          data: { targetLabel },
        },
      ]
    })
    return [...edges, ...guidanceEdges]
  }, [edges, nodes, resolveTruckDestination])

  const updateTruckNode = useCallback(
    (truckId: string, position: FlowPosition, data: LogisticsNodeData) => {
      setNodes((current) =>
        current.map((node) => (node.id === truckId ? { ...node, position, data } : node)),
      )
      setSelectedNode((prev) =>
        prev?.id === truckId ? { ...prev, position, data } : prev,
      )
      setDraft((prev) => (selectedNode?.id === truckId ? data : prev))
    },
    [selectedNode?.id, setNodes],
  )

  const handleTruckDestinationChange = useCallback(
    (targetNodeId: string) => {
      if (!selectedNode || selectedNode.type !== 'truck') return
      const target = nodes.find((node) => node.id === targetNodeId)
      const nextData: LogisticsNodeData = {
        ...draft,
        targetNodeId,
        targetLabel: target?.data.label ?? '',
      }
      setDraft(nextData)
      setNodes((current) =>
        current.map((node) => (node.id === selectedNode.id ? { ...node, data: { ...node.data, ...nextData } } : node)),
      )
      setSelectedNode((prev) => (prev ? { ...prev, data: { ...prev.data, ...nextData } } : null))
    },
    [draft, nodes, selectedNode, setNodes],
  )

  const handleStopTruck = useCallback(() => {
    const truckId = animatingTruckId ?? selectedNode?.id
    if (!truckId) return

    cancelTruckAnimation()

    const truck = nodes.find((node) => node.id === truckId)
    if (!truck) return

    const idleData: LogisticsNodeData = { ...truck.data, ...draft, status: 'idle' }
    updateTruckNode(truckId, truck.position, idleData)
    showToast({ variant: 'info', title: 'Движение остановлено' })
  }, [animatingTruckId, cancelTruckAnimation, draft, nodes, selectedNode?.id, showToast, updateTruckNode])

  const handleMoveTruck = useCallback(() => {
    if (!selectedNode || selectedNode.type !== 'truck' || animatingTruckId) return

    const targetId = draft.targetNodeId
    if (!targetId) {
      showToast({ variant: 'warning', title: 'Выберите пункт назначения' })
      return
    }

    const target = nodes.find((node) => node.id === targetId)
    const truck = nodes.find((node) => node.id === selectedNode.id)
    if (!target || !truck) {
      showToast({ variant: 'error', title: 'Цель не найдена на схеме' })
      return
    }

    const from: FlowPosition = { ...truck.position }
    const to: FlowPosition = { ...target.position }
    const movingData: LogisticsNodeData = {
      ...truck.data,
      ...draft,
      status: 'moving',
      targetNodeId: targetId,
      targetLabel: draft.targetLabel ?? target.data.label,
    }

    pushSnapshot()
    stopTruckAnimationRef.current = false
    setAnimatingTruckId(truck.id)
    updateTruckNode(truck.id, from, movingData)

    const startedAt = performance.now()

    const tick = (now: number) => {
      if (stopTruckAnimationRef.current) return

      const progress = Math.min(1, (now - startedAt) / TRUCK_TRAVEL_MS)
      const eased = easeOutCubic(progress)
      const position = lerpPosition(from, to, eased)

      updateTruckNode(truck.id, position, movingData)

      if (progress < 1) {
        truckAnimationFrameRef.current = requestAnimationFrame(tick)
        return
      }

      truckAnimationFrameRef.current = null
      setAnimatingTruckId(null)
      const arrivedData: LogisticsNodeData = { ...movingData, status: 'idle' }
      updateTruckNode(truck.id, to, arrivedData)
      showToast({ variant: 'success', title: 'Грузовик прибыл в пункт назначения' })
    }

    truckAnimationFrameRef.current = requestAnimationFrame(tick)
  }, [
    animatingTruckId,
    draft,
    nodes,
    pushSnapshot,
    selectedNode,
    showToast,
    updateTruckNode,
  ])

  useEffect(() => {
    setEdges((current) => updateEdgeSimulationFlag(current))
  }, [isSimulationActive, setEdges, updateEdgeSimulationFlag])

  const connectionLineStyle = useMemo(() => ({ stroke: '#3b82f6', strokeWidth: 2 }), [])

  const displayNodes = useMemo(
    () =>
      nodes.map((node) =>
        node.type === 'truck' && node.id === animatingTruckId ? { ...node, draggable: false } : node,
      ),
    [animatingTruckId, nodes],
  )

  return (
    <section className="flex h-[calc(100vh-9.5rem)] min-h-[680px] overflow-hidden rounded-xl border border-surface-700 bg-surface-900">
      <ElementsSidebar onDragStart={onDragStart} />
      <div className="relative flex flex-1 flex-col">
        <CanvasToolbar
          onZoomIn={() => reactFlow.zoomIn()}
          onZoomOut={() => reactFlow.zoomOut()}
          onFitView={() => reactFlow.fitView({ padding: 0.2 })}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSave={saveSchema}
          onLoad={loadSchema}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
        />
        <div ref={wrapperRef} className="h-full w-full" onDrop={onDrop} onDragOver={(event) => event.preventDefault()}>
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onConnect={onConnect}
            fitView
            isValidConnection={validateConnection}
            connectionMode={ConnectionMode.Loose}
            connectionLineStyle={connectionLineStyle}
          >
            <Background color="#1e293b" gap={20} size={1.5} />
            <MiniMap
              pannable
              zoomable
              className="!bg-surface-800/90 !backdrop-blur-xl"
              nodeColor={(node) =>
                node.type === 'point' ? '#3b82f6' : node.type === 'warehouse' ? '#f59e0b' : '#10b981'
              }
              maskColor="rgba(15, 23, 42, 0.45)"
            />
            <Controls className="!border-surface-700 !bg-surface-800 !text-slate-100" />
            <Panel position="top-right" className="rounded-lg border border-surface-700 bg-surface-800/80 px-3 py-1 text-xs text-slate-300">
              Только Point ↔ Warehouse соединения
            </Panel>
          </ReactFlow>
        </div>
      </div>
      <PropertiesPanel
        selectedNode={selectedNode}
        selectedEdge={selectedEdge}
        draft={draft}
        setDraft={setDraft}
        destinationNodes={nodes.filter((node) => node.type === 'point' || node.type === 'warehouse')}
        isTruckAnimating={animatingTruckId === selectedNode?.id}
        onMoveTruck={handleMoveTruck}
        onStopTruck={handleStopTruck}
        onTruckDestinationChange={handleTruckDestinationChange}
        onApply={handleApply}
        onCancel={handleCancel}
        onDelete={handleDelete}
      />
    </section>
  )
}

export const ConstructorPage = () => (
  <div className="space-y-4">
    <h2 className="text-2xl font-semibold">Конструктор логистической сети</h2>
    <ReactFlowProvider>
      <ConstructorCanvas />
    </ReactFlowProvider>
  </div>
)
