import { useState } from 'react'
import { Info } from 'lucide-react'
import { cn } from '../../utils/cn'

interface HelpTooltipProps {
  text: string
  className?: string
}

export const HelpTooltip = ({ text, className }: HelpTooltipProps) => {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-label={text}
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors duration-200 hover:text-primary-300"
      >
        <Info size={14} />
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-xl border border-surface-700 bg-surface-900/95 px-3 py-2 text-xs text-slate-100 shadow-accent"
        >
          {text}
        </div>
      )}
    </div>
  )
}
