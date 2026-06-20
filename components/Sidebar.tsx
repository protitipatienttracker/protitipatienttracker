'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Calendar, Users, UserPlus, ArrowLeftRight,
  ClipboardList, Clock, Archive, Brain, CalendarDays,
  BarChart2, TrendingUp, Settings, Bell, Search
} from 'lucide-react'

type PageId =
  | 'dashboard' | 'calendar'
  | 'all-patients' | 'new-admission' | 'transfers'
  | 'active-admissions' | 'renewals-due' | 'discharged'
  | 'capacity-assessments' | 'assessment-schedule'
  | 'occupancy-report' | 'admission-analytics'
  | 'settings' | 'notification-preferences'

interface NavItem {
  id: PageId
  label: string
  icon: React.ReactNode
}

interface NavSection {
  title: string
  items: NavItem[]
}

const sections: NavSection[] = [
  {
    title: 'MAIN',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-4 h-4" /> },
    ],
  },
  {
    title: 'PATIENTS',
    items: [
      { id: 'all-patients', label: 'All Patients', icon: <Users className="w-4 h-4" /> },
      { id: 'new-admission', label: 'New Admission', icon: <UserPlus className="w-4 h-4" /> },
      { id: 'transfers', label: 'Transfers & Shifts', icon: <ArrowLeftRight className="w-4 h-4" /> },
    ],
  },
  {
    title: 'ADMISSIONS',
    items: [
      { id: 'active-admissions', label: 'Active Admissions', icon: <ClipboardList className="w-4 h-4" /> },
      { id: 'renewals-due', label: 'Renewals Due', icon: <Clock className="w-4 h-4" /> },
      { id: 'discharged', label: 'Discharged Patients', icon: <Archive className="w-4 h-4" /> },
    ],
  },
  {
    title: 'ASSESSMENTS',
    items: [
      { id: 'capacity-assessments', label: 'Capacity Assessments', icon: <Brain className="w-4 h-4" /> },
      { id: 'assessment-schedule', label: 'Assessment Schedule', icon: <CalendarDays className="w-4 h-4" /> },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      { id: 'occupancy-report', label: 'Occupancy Report', icon: <BarChart2 className="w-4 h-4" /> },
      { id: 'admission-analytics', label: 'Admission Analytics', icon: <TrendingUp className="w-4 h-4" /> },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
      { id: 'notification-preferences', label: 'Notification Prefs', icon: <Bell className="w-4 h-4" /> },
    ],
  },
]

interface SidebarProps {
  activePage: string
  onNavigate: (page: PageId) => void
  onSearch: (q: string) => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ activePage, onNavigate, onSearch, mobileOpen, onMobileClose }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  function handleSearch(v: string) {
    setSearchQuery(v)
    onSearch(v)
  }

  return (
    <>
    {/* Mobile backdrop */}
    {mobileOpen && (
      <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onMobileClose} />
    )}
    <aside
      className={cn(
        'flex flex-col h-screen bg-[#0A2A2A] text-slate-200 shrink-0 transition-all duration-300 overflow-hidden',
        // Desktop
        'hidden lg:flex',
        collapsed ? 'w-14' : 'w-60',
        // Mobile overlay
        mobileOpen && '!fixed inset-y-0 left-0 !flex w-60 z-50'
      )}
      onMouseEnter={() => collapsed && setCollapsed(false)}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
        <img src="/applogo.png" alt="Protiti" className="w-8 h-8 rounded-lg shrink-0" />
        {!collapsed && (
          <>
            <span className="text-white font-bold text-lg tracking-tight">Protiti</span>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse ml-auto" title="System Online" />
          </>
        )}
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search patients..."
              className="w-full bg-white/10 text-slate-200 placeholder-slate-500 rounded-md pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#0D6E6E]"
            />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4">
        {sections.map(section => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-4 text-[11px] font-semibold tracking-widest text-slate-500 mb-1">
                {section.title}
              </p>
            )}
            {section.items.map(item => {
              const isActive = activePage === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors relative',
                    isActive
                      ? 'text-white bg-white/10 border-l-[3px] border-[#F59E0B]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-l-[3px] border-transparent'
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 px-4 py-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-[#0D6E6E] flex items-center justify-center text-white text-xs font-bold shrink-0">
          AS
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">Arjun Sathe</p>
            <p className="text-xs text-slate-500">Psychiatrist</p>
          </div>
        )}
      </div>
    </aside>
    </>
  )
}
