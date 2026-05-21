import { X } from 'lucide-react'
import { useEffect } from 'react'
import type { PropsWithChildren } from 'react'
import { cn } from '../../utils/cn'

interface ModalProps extends PropsWithChildren {
  open: boolean
  title: string
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export const Modal = ({ open, title, onClose, children, size = 'md' }: ModalProps) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xl"
      onMouseDown={onClose}
    >
      <div
        className={cn(
          'w-full animate-scale-in rounded-xl border border-surface-700 bg-surface-800/80 p-6 shadow-accent',
          sizes[size],
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
          <button
            type="button"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-surface-700 hover:text-slate-200"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
