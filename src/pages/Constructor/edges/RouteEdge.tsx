import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow'
import { cn } from '../../../utils/cn'
import type { RouteEdgeData } from '../types'

const getEdgeColor = (load: number) => {
  if (load >= 80) return '#ef4444'
  if (load >= 50) return '#f59e0b'
  return '#10b981'
}

export const RouteEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<RouteEdgeData>) => {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const routeLoad = data?.routeLoad ?? 0
  const stroke = getEdgeColor(routeLoad)

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth: 2,
          strokeDasharray: '8 6',
          animation: data?.isSimulationActive ? 'dashdraw 0.9s linear infinite' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={cn(
            'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-surface-700 bg-surface-800 px-2 py-1 text-[10px] font-mono text-slate-200',
          )}
          style={{ left: labelX, top: labelY }} >
          {data?.distance ?? '0 км'}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
