'use client'
import { useState } from 'react'
import { X, CheckCircle2, AlertCircle, Info, Bell, Check, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification } from '@/lib/data'

const iconMap = {
  error:   <AlertCircle className="w-4 h-4 text-[#FF3B30] shrink-0" />,
  warning: <AlertCircle className="w-4 h-4 text-[#FF9500] shrink-0" />,
  success: <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0" />,
  info:    <Info className="w-4 h-4 text-[#007AFF] shrink-0" />,
}

const typeBg: Record<string, string> = {
  error:   'bg-[#FF3B30]/10',
  warning: 'bg-[#FF9500]/10',
  success: 'bg-[#34C759]/10',
  info:    'bg-[#007AFF]/10',
}

function formatDueDate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const today = new Date(); today.setHours(0,0,0,0)
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000)
  const formatted = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  if (diff < 0) return `${formatted} · ${Math.abs(diff)}d overdue`
  if (diff === 0) return `${formatted} · Today`
  if (diff === 1) return `${formatted} · Tomorrow`
  return `${formatted} · in ${diff}d`
}

function groupByDate(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const today = new Date(); today.setHours(0,0,0,0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7)

  const groups: Record<string, Notification[]> = {}
  for (const n of notifications) {
    const t = new Date(n.time)
    let label = 'Older'
    if (!isNaN(t.getTime())) {
      const d = new Date(t); d.setHours(0,0,0,0)
      if (d.getTime() === today.getTime()) label = 'Today'
      else if (d.getTime() === yesterday.getTime()) label = 'Yesterday'
      else if (d >= weekAgo) label = 'This Week'
    }
    if (!groups[label]) groups[label] = []
    groups[label].push(n)
  }
  const order = ['Today', 'Yesterday', 'This Week', 'Older']
  return order.filter(l => groups[l]).map(l => ({ label: l, items: groups[l] }))
}

interface Props {
  open: boolean
  notifications: Notification[]
  onClose: () => void
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
}

export default function NotificationDrawer({ open, notifications, onClose, onMarkRead, onMarkAllRead }: Props) {
  const [tab, setTab] = useState<'unread' | 'all'>('unread')

  const unread = notifications.filter(n => !n.read).length
  const visible = tab === 'unread' ? notifications.filter(n => !n.read) : notifications
  const groups = groupByDate(visible)

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-[340px] bg-[#F2F2F7] z-50 flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ boxShadow: open ? '-8px 0 32px rgba(0,0,0,0.12)' : 'none' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 bg-white ios-separator">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
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

          {/* Tabs */}
          <div className="flex bg-[#F2F2F7] rounded-xl p-0.5 gap-0.5">
            {(['unread', 'all'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-1.5 rounded-[10px] text-[13px] font-medium transition-all',
                  tab === t ? 'bg-white text-[#000000] shadow-sm' : 'text-[#8E8E93]'
                )}
              >
                {t === 'unread' ? `Unread${unread > 0 ? ` (${unread})` : ''}` : `All (${notifications.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Mark all read */}
        {unread > 0 && (
          <div className="px-5 py-2 bg-white ios-separator flex justify-end">
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1.5 text-[12px] text-[#007AFF] font-medium active:opacity-60"
            >
              <Check className="w-3.5 h-3.5" />
              Mark all as read
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-[#8E8E93]">
              <CheckCircle2 className="w-10 h-10 opacity-30" />
              <p className="text-[14px] font-medium">All caught up</p>
              <p className="text-[12px]">No unread notifications</p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.label}>
                <p className="px-5 py-2 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">
                  {group.label}
                </p>
                <div className="px-3 space-y-1">
                  {group.items.map(n => (
                    <div
                      key={n.id}
                      className={cn(
                        'flex items-start gap-3 px-3 py-3 rounded-xl transition-colors',
                        n.read ? 'bg-white/50' : 'bg-white',
                      )}
                      style={{ boxShadow: !n.read ? '0 1px 4px rgba(0,0,0,0.06)' : 'none' }}
                    >
                      {/* Type icon */}
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', typeBg[n.type])}>
                        {iconMap[n.type]}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-[13px] leading-snug', n.read ? 'text-[#3A3A3C]' : 'text-[#000000] font-medium')}>
                          {n.title}
                        </p>
                        <p className="text-[12px] text-[#8E8E93] mt-0.5 leading-snug">{n.message}</p>
                        {n.time && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Calendar className="w-3 h-3 text-[#C7C7CC]" />
                            <p className="text-[11px] text-[#C7C7CC]">{formatDueDate(n.time)}</p>
                          </div>
                        )}
                      </div>

                      {/* Mark read checkbox */}
                      <button
                        onClick={() => onMarkRead(n.id)}
                        title={n.read ? 'Read' : 'Mark as read'}
                        className={cn(
                          'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all active:scale-90',
                          n.read
                            ? 'bg-[#34C759] border-[#34C759]'
                            : 'border-[#C7C7CC] hover:border-[#007AFF]'
                        )}
                      >
                        {n.read && <Check className="w-3 h-3 text-white" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
