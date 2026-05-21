import type { InputHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

type Variant = 'default' | 'filled'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: LucideIcon
  variant?: Variant
}

const variants: Record<Variant, string> = {
  default: 'bg-surface-900',
  filled: 'bg-surface-800',
}

export const Input = ({ className, label, error, leftIcon: Icon, variant = 'default', id, ...props }: InputProps) => (
  <label className="block space-y-2">
    {label && <span className="text-sm text-slate-300">{label}</span>}
    <div className="relative">
      {Icon && <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
      <input
        id={id}
        className={cn(
          'w-full rounded-lg border border-surface-700 px-3 py-2 text-sm text-slate-100 outline-none transition-all duration-300 ease-in-out placeholder:text-slate-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 disabled:cursor-not-allowed disabled:opacity-60',
          variants[variant],
          Icon && 'pl-10',
          error && 'border-danger focus:border-danger focus:ring-danger/40',
          className,
        )}
        {...props}
      />
    </div>
    {error && <p className="text-xs text-danger">{error}</p>}
  </label>
)
