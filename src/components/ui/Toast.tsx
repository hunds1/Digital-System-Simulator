import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { cn } from '../../utils/cn'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

interface ShowToastArgs {
  title: string
  description?: string
  variant?: ToastVariant
}

interface ToastContextValue {
  showToast: (toast: ShowToastArgs) => void
}

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const variants = {
  success: 'border-success/30 bg-success/10 text-success',
  error: 'border-danger/30 bg-danger/10 text-danger',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-primary-500/30 bg-primary-500/10 text-primary-400',
}

const ToastContext = createContext<ToastContextValue | null>(null)

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    ({ title, description, variant = 'info' }: ShowToastArgs) => {
      const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `toast-${Math.random().toString(36).slice(2)}-${Date.now()}`
      setToasts((prev) => [...prev, { id, title, description, variant }])
      window.setTimeout(() => hideToast(id), 5000)
    },
    [hideToast],
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const Icon = icons[toast.variant]
          return (
            <div
              key={toast.id}
              className={cn(
                'animate-slide-in-right rounded-xl border bg-surface-800/95 p-4 shadow-accent backdrop-blur-xl',
                variants[toast.variant],
              )}
            >
              <div className="flex items-start gap-3">
                <Icon size={18} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{toast.title}</p>
                  {toast.description && <p className="mt-1 text-xs text-slate-300">{toast.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => hideToast(toast.id)}
                  className="rounded p-1 text-slate-400 transition-colors hover:bg-surface-700 hover:text-slate-200"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
