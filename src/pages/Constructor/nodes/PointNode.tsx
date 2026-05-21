import { MapPin } from 'lucide-react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { cn } from '../../../utils/cn'
import type { LogisticsNodeData } from '../types'

export const PointNode = ({ data, selected }: NodeProps<LogisticsNodeData>) => (
  <div
    className={cn(
      'min-w-52 rounded-xl border border-primary-500/60 bg-primary-500/10 p-3 text-slate-100 shadow-accent transition-all duration-300 ease-in-out',
      selected && 'ring-2 ring-primary-500/60',
    )}
  >
    <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !bg-primary-500" />
    <div className="mb-2 flex items-center gap-2">
      <MapPin size={16} className="text-primary-400" />
      <p className="text-sm font-semibold">Point #{data.label}</p>
    </div>
    <p className="text-xs text-slate-300">{data.subtitle ?? 'Пункт назначения'}</p>
    <p className="mt-2 font-mono text-xs text-primary-300">Заказы: {data.orders ?? 0}</p>
    <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-primary-500" />
  </div>
)
