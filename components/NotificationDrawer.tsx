'use client'
import { X, CheckCircle2, AlertCircle, Info, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification } from '@/lib/data'

const iconMap = {
  error: <AlertCircle className="w-5 h-5 text-[#FF3B30] shrink-0" />,
  warning: <AlertCircle className="w-5 h-5 text-[#FF9500] shrink-0" />,
  success: <CheckCircle2 className="w-5 h-5 text-[#34C759] shrink-0" />,
  info: <Info className="w-5 h-5 text-[#007AFF] shrink-0" />,
}

function relativeTime(time: string): string {
  if (!time) return ''
  const now = new Date()
  const t = new Date(time)
  if (isNaN(t.getTime())) return time
  const diffMs = now.getTime() - t.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return time
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
      {open && <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-80 bg-[#F2F2F7] z-50 flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ boxShadow: open ? '-8px 0 32px rgba(0,0,0,0.1)' : 'none' }}
      >
        <div className="flex items-center justify-between px-5 py-4 bg-white ios-separator">
          <div className="flex items-center gap-2.5">
            <Bell className="w-[18px] h-[18px] text-[#007AFF]" />
            <h2 className="font-semibold text-[#000000] text-[17px]">Notifications</h2>
            {unread > 0 && (
              <span className="bg-[#FF3B30] text-white text-[11px] px-2 py-0.5 rounded-full font-semibold">
                {unread}
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[#8E8E93] active:bg-[#E5E5EA]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {unread > 0 && (
          <div className="px-5 py-2.5 bg-white ios-separator">
            <button onClick={onMarkAllRead} className="text-[13px] text-[#007AFF] font-medium active:opacity-60">
              Mark all as read
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-[#8E8E93]">
              <Bell className="w-8 h-8" />
              <p className="text-[14px]">No notifications</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => onMarkRead(n.id)}
                className={cn(
                  'flex items-start gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-colors',
                  !n.read ? 'bg-white' : 'bg-white/60',
                )}
                style={{ boxShadow: !n.read ? '0 0 0 0.5px rgba(0,0,0,0.04)' : 'none' }}
              >
                {iconMap[n.type]}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-[14px]', n.read ? 'text-[#3A3A3C]' : 'text-[#000000] font-medium')}>
                      {n.title}
                    </p>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-[#007AFF] shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-[12px] text-[#8E8E93] mt-0.5">{n.message}</p>
                  <p className="text-[11px] text-[#C7C7CC] mt-1">{relativeTime(n.time)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
