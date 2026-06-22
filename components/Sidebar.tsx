'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Calendar, Users, UserPlus, ArrowLeftRight,
  ClipboardList, Clock, Archive, Brain, CalendarDays,
  BarChart2, TrendingUp, Settings, Bell, Search
} from 'lucide-react'
import type { Patient } from '@/lib/data'

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
  badge?: number
}

interface NavSection {
  title: string
  items: NavItem[]
}

interface SidebarProps {
  activePage: string
  onNavigate: (page: PageId) => void
  onSearch: (q: string) => void
  mobileOpen?: boolean
  onMobileClose?: () => void
  patients?: Patient[]
  onViewPatient?: (id: string) => void
}

export default function Sidebar({ activePage, onNavigate, onSearch, mobileOpen, onMobileClose, patients = [], onViewPatient }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const overdueRenewals = patients.filter(p =>
    p.admissionType !== 'Discharged' &&
    (p.nextActionType === 'Shift to CHS' || p.nextActionType === 'Shift to HS >90 days' || p.nextActionType === 'Shift to HS >30 days') &&
    p.nextActionDue !== '—' && new Date(p.nextActionDue) <= new Date()
  ).length

  const sections: NavSection[] = [
    {
      title: 'MAIN',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
        { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      title: 'PATIENTS',
      items: [
        { id: 'all-patients', label: 'All Patients', icon: <Users className="w-[18px] h-[18px]" /> },
        { id: 'new-admission', label: 'New Admission', icon: <UserPlus className="w-[18px] h-[18px]" /> },
        { id: 'transfers', label: 'Transfers', icon: <ArrowLeftRight className="w-[18px] h-[18px]" /> },
        { id: 'discharged', label: 'Discharged', icon: <Archive className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      title: 'ASSESSMENTS & REPORTS',
      items: [
        { id: 'capacity-assessments', label: 'Assessments', icon: <Brain className="w-[18px] h-[18px]" /> },
        { id: 'occupancy-report', label: 'Reports & Analytics', icon: <BarChart2 className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      title: 'SETTINGS',
      items: [
        { id: 'settings', label: 'Settings', icon: <Settings className="w-[18px] h-[18px]" /> },
      ],
    },
  ]

  function handleSearch(v: string) {
    setSearchQuery(v)
    onSearch(v)
  }

  const searchResults = searchQuery.trim().length > 0
    ? patients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5)
    : []

  return (
    <>
    {mobileOpen && (
      <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onMobileClose} />
    )}
    <aside
      className={cn(
        'flex flex-col h-screen w-64 bg-[#1C1C1E] text-white shrink-0 transition-transform duration-300 overflow-hidden',
        'hidden lg:flex',
        mobileOpen && '!fixed inset-y-0 left-0 !flex z-50'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <img src="/applogo.png" alt="Pratiti" className="w-9 h-9 rounded-xl shrink-0" />
        <span className="text-white font-semibold text-[17px] tracking-tight">Pratiti</span>
        <span className="w-2 h-2 rounded-full bg-[#34C759] ml-auto" title="Online" />
      </div>

      {/* Search */}
      <div className="px-4 pb-3 relative">
        <div className="relative">
          <Search className="absolute left-3 top-[9px] w-[14px] h-[14px] text-[#8E8E93]" />
          <input
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder="Search patients..."
            className="w-full bg-[#2C2C2E] text-white placeholder-[#8E8E93] rounded-xl pl-8 pr-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#006400]/50"
          />
        </div>
        {/* Search dropdown */}
        {searchFocused && searchResults.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-[#2C2C2E] rounded-xl overflow-hidden z-50 border border-white/10" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            {searchResults.map(p => (
              <button
                key={p.id}
                onMouseDown={() => { onViewPatient?.(p.id); setSearchQuery('') }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/8 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[#006400] flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
                  {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] text-white truncate">{p.name}</p>
                  <p className="text-[11px] text-[#8E8E93]">{p.id} · {p.admissionType}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {searchFocused && searchQuery.trim().length > 0 && searchResults.length === 0 && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-[#2C2C2E] rounded-xl overflow-hidden z-50 border border-white/10 px-4 py-3">
            <p className="text-[12px] text-[#8E8E93]">No patients found</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-5">
        {sections.map(section => (
          <div key={section.title}>
            <p className="px-3 text-[11px] font-semibold tracking-wider text-[#8E8E93] mb-1.5">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const isActive = activePage === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] transition-all active:scale-[0.97]',
                      isActive
                        ? 'bg-[#006400] text-white font-medium'
                        : 'text-[#EBEBF5]/80 hover:bg-white/8'
                    )}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto bg-[#FF3B30] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 px-4 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#006400] to-[#004d00] flex items-center justify-center text-white text-xs font-semibold shrink-0">
          AS
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-white truncate">Arjun Sathe</p>
        </div>
      </div>
    </aside>
    </>
  )
}
