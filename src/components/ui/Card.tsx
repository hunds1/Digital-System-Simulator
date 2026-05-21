import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

type CardVariant = 'elevated' | 'outlined' | 'glass'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  title?: string
  action?: ReactNode
  hoverable?: boolean
}

const variantStyles: Record<CardVariant, string> = {
  elevated: 'border border-surface-700 bg-surface-800 shadow-accent',
  outlined: 'border border-surface-700 bg-surface-900',
  glass: 'border border-slate-500/30 bg-surface-800/80 backdrop-blur-xl shadow-accent',
}

export const Card = ({
  className,
  variant = 'elevated',
  title,
  action,
  hoverable = true,
  children,
  ...props
}: CardProps) => (
  <div
    className={cn(
      'rounded-xl p-6 transition-all duration-300 ease-in-out',
      variantStyles[variant],
      hoverable && 'hover:-translate-y-1 hover:shadow-accent',
      className,
    )}
    {...props}
  >
    {(title || action) && (
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        {action}
      </div>
    )}
    {children}
  </div>
)
