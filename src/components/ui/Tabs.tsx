import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface TabItem {
  key: string
  label: string
  icon?: LucideIcon
}

interface TabsProps {
  items: TabItem[]
  activeTab: string
  onChange: (tabKey: string) => void
  className?: string
}

export const Tabs = ({ items, activeTab, onChange, className }: TabsProps) => (
  <div className={cn('flex items-center gap-4 border-b border-surface-700', className)}>
    {items.map((item) => {
      const isActive = item.key === activeTab
      const Icon = item.icon

      return (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            'relative inline-flex h-11 items-center gap-2 px-1 text-sm font-medium text-slate-400 transition-colors duration-300 ease-in-out hover:text-slate-200',
            isActive && 'text-primary-400',
          )}
        >
          {Icon && <Icon size={16} />}
          <span>{item.label}</span>
          <span
            className={cn(
              'absolute -bottom-px left-0 h-0.5 w-full origin-left scale-x-0 bg-primary-500 transition-transform duration-300 ease-in-out',
              isActive && 'scale-x-100',
            )}
          />
        </button>
      )
    })}
  </div>
)
