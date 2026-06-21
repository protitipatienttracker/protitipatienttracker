'use client'
import { Bell, ChevronRight, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification } from '@/lib/data'

const PAGE_TITLES: Record<string, string> = {
  'dashboard': 'Dashboard',
  'calendar': 'Calendar',
  'all-patients': 'All Patients',
  'new-admission': 'New Admission',
  'transfers': 'Transfers & Shifts',
  'active-admissions': 'Active Admissions',
  'renewals-due': 'Renewals Due',
  'discharged': 'Discharged',
  'capacity-assessments': 'Capacity Assessments',
  'assessment-schedule': 'Assessment Schedule',
  'occupancy-report': 'Occupancy Report',
  'admission-analytics': 'Analytics',
  'settings': 'Settings',
  'notification-preferences': 'Notifications',
  'patient-detail': 'Patient Detail',
}

interface BreadcrumbItem {
  label: string
  pageId?: string
}

interface HeaderProps {
  pageId: string
  breadcrumbs?: BreadcrumbItem[]
  notifications: Notification[]
  onBellClick: () => void
  onNavigate?: (id: string) => void
  onMenuClick?: () => void
  accentColor?: string
}

export default function Header({ pageId, breadcrumbs, notifications, onBellClick, onNavigate, onMenuClick, accentColor = '#007AFF' }: HeaderProps) {
  const unread = notifications.filter(n => !n.read).length

  return (
    <div className="ios-blur border-b border-[rgba(60,60,67,0.1)] px-5 sm:px-6 shrink-0 sticky top-0 z-30" style={{ borderTopColor: accentColor, borderTopWidth: '2px', borderTopStyle: 'solid' }}>
      <div className="flex items-center justify-between h-[52px]">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 rounded-xl text-[#8E8E93] hover:bg-black/5 active:bg-black/8"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[17px] font-semibold text-[#000000]">
              {PAGE_TITLES[pageId] ?? pageId}
            </h1>
            {breadcrumbs && breadcrumbs.length > 0 && (
              <div className="flex items-center gap-1">
                {breadcrumbs.map((b, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-[#8E8E93]" />}
                    {b.pageId ? (
                      <button
                        onClick={() => onNavigate?.(b.pageId!)}
                        className="text-[12px] text-[#007AFF] active:opacity-60"
                      >
                        {b.label}
                      </button>
                    ) : (
                      <span className="text-[12px] text-[#8E8E93]">{b.label}</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[13px] font-medium text-[#000000]">Arjun Sathe</p>
          </div>

          <button
            onClick={onBellClick}
            className="relative w-9 h-9 flex items-center justify-center rounded-full bg-[#F2F2F7] active:bg-[#E5E5EA] transition-colors"
          >
            <Bell className="w-[18px] h-[18px] text-[#3A3A3C]" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-[#FF3B30] text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
