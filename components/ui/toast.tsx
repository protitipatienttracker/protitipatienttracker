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
}

const icons = {
  success: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  error: <AlertCircle className="w-4 h-4 text-red-600" />,
  warning: <AlertCircle className="w-4 h-4 text-amber-600" />,
  info: <Info className="w-4 h-4 text-blue-600" />,
}

const colors = {
  success: 'border-l-4 border-green-500',
  error: 'border-l-4 border-red-500',
  warning: 'border-l-4 border-amber-500',
  info: 'border-l-4 border-blue-500',
}

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])

  return (
    <div className={cn('bg-white shadow-lg rounded-lg p-4 flex items-start gap-3 min-w-[320px] max-w-[400px]', colors[toast.type])}>
      <span className="mt-0.5 shrink-0">{icons[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{toast.title}</p>
        {toast.message && <p className="text-xs text-slate-500 mt-0.5">{toast.message}</p>}
      </div>
      <button onClick={() => onDismiss(toast.id)} className="shrink-0 text-slate-400 hover:text-slate-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  )
}
