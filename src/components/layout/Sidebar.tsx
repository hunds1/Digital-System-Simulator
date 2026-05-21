import { BarChart3, ChevronLeft, ChevronRight, Settings, SlidersHorizontal, Workflow } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useUiStore } from '../../store/uiStore'
import { cn } from '../../utils/cn'

const navItems = [
  { to: '/constructor', label: 'Конструктор', icon: Workflow },
  { to: '/simulation', label: 'Симуляция', icon: SlidersHorizontal },
  { to: '/settings', label: 'Настройки', icon: Settings },
  { to: '/results', label: 'Результаты', icon: BarChart3 },
]

export const Sidebar = () => {
  const { isSidebarCollapsed, toggleSidebar } = useUiStore()

  return (
    <aside
      className={cn(
        'sticky top-0 h-screen border-r border-surface-700 bg-surface-800/80 p-3 backdrop-blur-xl transition-all duration-300 ease-in-out',
        isSidebarCollapsed ? 'w-[72px]' : 'w-[260px]',
      )}
    >
      <div className="mb-6 flex items-center justify-between">
        {!isSidebarCollapsed && <span className="text-sm font-semibold text-slate-200">System Lab</span>}
        <button
          onClick={toggleSidebar}
          className="rounded-full bg-surface-700 p-2 text-slate-200 transition-colors hover:bg-surface-900"
          aria-label="Toggle sidebar"
        >
          {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="space-y-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300 transition-all duration-300 ease-in-out',
                isActive && 'bg-primary-500/20 text-primary-400 shadow-accent',
                !isActive && 'hover:bg-surface-900',
              )
            }
          >
            <Icon size={18} />
            {!isSidebarCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
