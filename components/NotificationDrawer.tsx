'use client'
import { X, CheckCircle2, AlertCircle, Info, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification } from '@/lib/data'

const iconMap = {
  error: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
  warning: <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />,
  success: <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-500 shrink-0" />,
}

interface Props {
  open: boolean
  notifications: Notification[]
  onClose: () => void
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
}

export default function NotificationDrawer({ open, notifications, onClose, onMarkRead, onMarkAllRead }: Props) {
  const unread = notifications.filter(n => !n.read).length

  return (
    <>
      {open && <div className="fixed inset-0 z-40" onClick={onClose} />}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-600" />
            <h2 className="font-semibold text-slate-800 text-sm">Notifications</h2>
            {unread > 0 && (
              <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                {unread} new
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {unread > 0 && (
          <div className="px-5 py-2 border-b border-slate-100">
            <button onClick={onMarkAllRead} className="text-xs text-[#0D6E6E] hover:underline">
              Mark all as read
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
              <Bell className="w-8 h-8" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => onMarkRead(n.id)}
                className={cn(
                  'flex items-start gap-3 px-5 py-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors',
                  !n.read && 'bg-blue-50/50'
                )}
              >
                {iconMap[n.type]}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm', n.read ? 'text-slate-600' : 'text-slate-800 font-medium')}>
                      {n.title}
                    </p>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{n.time}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
