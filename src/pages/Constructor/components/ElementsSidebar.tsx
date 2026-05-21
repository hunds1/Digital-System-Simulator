import { MapPin, Search, Truck, Warehouse } from 'lucide-react'
import type { DragEvent } from 'react'
import { useMemo, useState } from 'react'
import type { LogisticsNodeType } from '../types'

interface ElementsSidebarProps {
  onDragStart: (event: DragEvent<HTMLButtonElement>, nodeType: LogisticsNodeType) => void
}

const elements: Array<{ type: LogisticsNodeType; label: string; icon: typeof MapPin; tone: string }> = [
  { type: 'point', label: 'Пункт назначения', icon: MapPin, tone: 'text-primary-400 border-primary-500/40' },
  { type: 'warehouse', label: 'Склад', icon: Warehouse, tone: 'text-warning border-warning/40' },
  { type: 'truck', label: 'Грузовик', icon: Truck, tone: 'text-success border-success/40' },
]

export const ElementsSidebar = ({ onDragStart }: ElementsSidebarProps) => {
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () => elements.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  )

  return (
    <aside className="w-72 border-r border-surface-700 bg-surface-800/70 p-4 backdrop-blur-xl">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">Элементы сети</h3>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2">
        <Search size={14} className="text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск элементов..."
          className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.type}
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, item.type)}
              className={`w-full rounded-xl border bg-surface-900 p-3 text-left transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-accent ${item.tone}`}
            >
              <div className="flex items-center gap-2">
                <Icon size={16} />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">Перетащите на холст</p>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
