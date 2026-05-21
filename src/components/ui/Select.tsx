import { ChevronDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../utils/cn'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  className?: string
  options: SelectOption[]
  value?: string
  placeholder?: string
  disabled?: boolean
  searchable?: boolean
  onChange?: (value: string) => void
}

export const Select = ({
  className,
  options,
  value,
  placeholder = 'Выберите опцию',
  disabled = false,
  searchable = false,
  onChange,
}: SelectProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const active = options.find((option) => option.value === value)
  const filtered = useMemo(
    () => options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  )

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-surface-700 bg-surface-900 px-3 text-sm text-slate-100 transition-all duration-300 ease-in-out hover:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={cn(!active && 'text-slate-500')}>{active?.label ?? placeholder}</span>
        <ChevronDown size={16} className={cn('transition-transform duration-300', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full animate-scale-in rounded-xl border border-surface-700 bg-surface-800 p-2 shadow-accent">
          {searchable && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2">
              <Search size={14} className="text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск..."
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
            </div>
          )}

          <ul className="max-h-52 space-y-1 overflow-auto">
            {filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange?.(option.value)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-surface-900',
                    option.value === value && 'bg-primary-500/20 text-primary-400',
                  )}
                >
                  {option.label}
                </button>
              </li>
            ))}
            {!filtered.length && <li className="px-3 py-2 text-sm text-slate-500">Ничего не найдено</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
