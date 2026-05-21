import { BaseEdge, EdgeLabelRenderer, getStraightPath, MarkerType, type EdgeProps } from 'reactflow'

export interface TruckGuidanceEdgeData {
  targetLabel?: string
}

export const TruckGuidanceEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<TruckGuidanceEdgeData>) => {
  const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: '#10b981',
          strokeWidth: 2,
          strokeDasharray: '10 6',
          opacity: 0.85,
        }}
        markerEnd={MarkerType.ArrowClosed}
        markerStart={undefined}
      />
      {data?.targetLabel && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-md border border-success/40 bg-surface-900/90 px-2 py-0.5 text-[10px] text-success"
            style={{ left: labelX, top: labelY }}
          >
            → {data.targetLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
