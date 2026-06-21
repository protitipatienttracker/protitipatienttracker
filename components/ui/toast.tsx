'use client'
import { useEffect } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  action?: { label: string; onClick: () => void }
}

const icons = {
  success: <CheckCircle2 className="w-5 h-5 text-[#34C759]" />,
  error: <AlertCircle className="w-5 h-5 text-[#FF3B30]" />,
  warning: <AlertCircle className="w-5 h-5 text-[#FF9500]" />,
  info: <Info className="w-5 h-5 text-[#007AFF]" />,
}

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const duration = toast.action ? 6000 : 4000
    const t = setTimeout(() => onDismiss(toast.id), duration)
    return () => clearTimeout(t)
  }, [toast.id, toast.action, onDismiss])

  return (
    <div className="bg-white rounded-2xl p-4 flex items-start gap-3 min-w-[320px] max-w-[420px] animate-[slideDown_0.3s_ease]"
      style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.04)' }}>
      <span className="mt-0.5 shrink-0">{icons[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#000000]">{toast.title}</p>
        {toast.message && <p className="text-[12px] text-[#8E8E93] mt-0.5">{toast.message}</p>}
        {toast.action && (
          <button
            onClick={() => { toast.action!.onClick(); onDismiss(toast.id) }}
            className="mt-1.5 text-[13px] font-semibold text-[#007AFF] active:opacity-60"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button onClick={() => onDismiss(toast.id)} className="shrink-0 text-[#8E8E93] active:text-[#3A3A3C]">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  )
}
