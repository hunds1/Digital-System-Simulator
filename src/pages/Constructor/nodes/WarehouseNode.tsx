import { Warehouse } from 'lucide-react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { cn } from '../../../utils/cn'
import type { LogisticsNodeData } from '../types'

export const WarehouseNode = ({ data, selected }: NodeProps<LogisticsNodeData>) => (
  <div
    className={cn(
      'min-w-56 rounded-lg border border-warning/70 bg-warning/10 p-3 text-slate-100 transition-all duration-300 ease-in-out',
      selected && 'ring-2 ring-warning/70',
    )}
  >
    <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !bg-warning" />
    <div className="mb-2 flex items-center gap-2">
      <Warehouse size={16} className="text-warning" />
      <p className="text-sm font-semibold">{data.label}</p>
    </div>
    <p className="text-xs text-slate-300">Емкость: {data.capacity ?? 0} заказов</p>
    <p className="mt-2 text-xs text-warning">Пропускная: {data.throughput ?? 0}/ч</p>
    <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-warning" />
  </div>
)
