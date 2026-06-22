'use client'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn('relative bg-white rounded-t-2xl sm:rounded-2xl w-full flex flex-col max-h-[85vh] sm:max-h-[90vh]', sizes[size])}
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div className="flex items-center justify-between px-6 py-4 ios-separator shrink-0">
          <h2 className="text-[17px] font-semibold text-[#000000]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[#8E8E93] active:bg-[#E5E5EA] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
