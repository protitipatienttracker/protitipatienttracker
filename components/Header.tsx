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
  'discharged': 'Discharged Patients',
  'capacity-assessments': 'Capacity Assessments',
  'assessment-schedule': 'Assessment Schedule',
  'occupancy-report': 'Occupancy Report',
  'admission-analytics': 'Admission Analytics',
  'settings': 'Settings',
  'notification-preferences': 'Notification Preferences',
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
}

export default function Header({ pageId, breadcrumbs, notifications, onBellClick, onNavigate, onMenuClick }: HeaderProps) {
  const unread = notifications.filter(n => !n.read).length

  return (
    <div className="border-b border-slate-200 bg-white px-4 sm:px-6 py-0 shrink-0">
      <div className="flex items-center justify-between h-14">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
          <h1 className="text-lg font-semibold text-slate-800">
            {PAGE_TITLES[pageId] ?? pageId}
          </h1>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              {breadcrumbs.map((b, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-slate-400" />}
                  {b.pageId ? (
                    <button
                      onClick={() => onNavigate?.(b.pageId!)}
                      className="text-xs text-[#0D6E6E] hover:underline"
                    >
                      {b.label}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">{b.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-700">Arjun Sathe</p>
            <p className="text-xs text-slate-500">Psychiatrist</p>
          </div>

          <button
            onClick={onBellClick}
            className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
