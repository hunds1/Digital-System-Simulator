import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
}

const styles: Record<Variant, string> = {
  primary:
    'bg-primary-gradient text-white shadow-accent hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-400',
  secondary:
    'bg-surface-700 text-slate-100 hover:bg-surface-800 focus-visible:ring-2 focus-visible:ring-slate-500',
  ghost: 'bg-transparent text-slate-200 hover:bg-surface-800 focus-visible:ring-2 focus-visible:ring-slate-500',
  danger: 'bg-danger/90 text-white hover:bg-danger focus-visible:ring-2 focus-visible:ring-danger/60',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export const Button = ({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  disabled,
  children,
  ...props
}: ButtonProps) => (
  <button
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 ease-in-out focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
      sizes[size],
      styles[variant],
      className,
    )}
    disabled={disabled || loading}
    {...props}
  >
    {loading && <Loader2 size={16} className="animate-spin" />}
    {!loading && LeftIcon && <LeftIcon size={16} />}
    <span>{children}</span>
    {!loading && RightIcon && <RightIcon size={16} />}
  </button>
)
