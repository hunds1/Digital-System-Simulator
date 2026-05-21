import { Truck } from 'lucide-react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { cn } from '../../../utils/cn'
import type { LogisticsNodeData } from '../types'

export const TruckNode = ({ data, selected }: NodeProps<LogisticsNodeData>) => {
  const load = Math.max(0, Math.min(100, data.load ?? 0))
  const circumference = 2 * Math.PI * 16
  const dashOffset = circumference - (load / 100) * circumference

  return (
    <div
      className={cn(
        'min-w-56 rounded-lg border border-success/70 bg-success/10 p-3 text-slate-100 transition-all duration-300 ease-in-out',
        selected && 'ring-2 ring-success/70',
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !bg-success" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Truck size={16} className="text-success" />
            <p className="text-sm font-semibold">Truck #{data.label}</p>
          </div>
          <p className="text-xs text-slate-300">Статус: {data.status === 'moving' ? 'в пути' : 'ожидание'}</p>
          {data.targetLabel && (
            <p className="mt-1 text-xs font-medium text-success">→ {data.targetLabel}</p>
          )}
        </div>
        <div className="relative h-10 w-10">
          <svg viewBox="0 0 40 40" className="-rotate-90">
            <circle cx="20" cy="20" r="16" className="fill-none stroke-slate-600" strokeWidth="4" />
            <circle
              cx="20"
              cy="20"
              r="16"
              className="fill-none stroke-success transition-all duration-300 ease-in-out"
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono">{load}%</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-success" />
    </div>
  )
}
