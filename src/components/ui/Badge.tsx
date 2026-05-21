import type { HTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'online' | 'offline' | 'warning' | 'success'
  tone?: 'online' | 'offline' | 'warning' | 'success'
  withPulse?: boolean
}

const toneStyles = {
  online: 'bg-primary-500/20 text-primary-400',
  offline: 'bg-slate-500/20 text-slate-400',
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
}

export const Badge = ({ className, variant, tone, withPulse = true, children, ...props }: BadgeProps) => {
  const resolved = variant ?? tone ?? 'offline'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        toneStyles[resolved],
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          resolved === 'online' && 'bg-primary-400',
          resolved === 'success' && 'bg-success',
          resolved === 'warning' && 'bg-warning',
          resolved === 'offline' && 'bg-slate-500',
          withPulse && resolved === 'online' && 'animate-pulse-glow',
        )}
      />
      {children}
    </span>
  )
}
