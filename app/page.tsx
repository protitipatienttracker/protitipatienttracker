'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  mapDbPatientToUi, mapDbTransferToUi, mapDbNotificationToUi,
  type Patient, type Transfer, type Notification,
} from '@/lib/data'
import {
  fetchAllPatients, fetchTransfers, fetchNotifications,
  fetchPatientById, admitNewPatient, addCapacityAssessment,
  dischargePatient, addClinicalNote, addBillingPeriod,
  markBillingPaid, insertTransfer, insertNotification,
  markNotificationRead, markAllNotificationsRead,
  fetchAllPatientCodes, getNextPatientCode, calcAge,
  undoDischarge,
} from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { type Toast, ToastContainer } from '@/components/ui/toast'
import type { ToastType } from '@/components/ui/toast'

import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import NotificationDrawer from '@/components/NotificationDrawer'

import Dashboard from '@/components/pages/Dashboard'
import AllPatients from '@/components/pages/AllPatients'
import PatientDetail from '@/components/pages/PatientDetail'
import NewAdmission from '@/components/pages/NewAdmission'
import CapacityAssessments from '@/components/pages/CapacityAssessments'
import RenewalsDue from '@/components/pages/RenewalsDue'
import Transfers from '@/components/pages/Transfers'
import Discharged from '@/components/pages/Discharged'
import CalendarPage from '@/components/pages/CalendarPage'
import OccupancyReport from '@/components/pages/OccupancyReport'
import Settings from '@/components/pages/Settings'

import { LayoutDashboard, Users, Calendar, Settings as SettingsIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OnboardingTooltip } from '@/components/ui/onboarding'

export type PageId =
  | 'dashboard'
  | 'all-patients'
  | 'patient-detail'
  | 'new-admission'
  | 'capacity-assessments'
  | 'renewals-due'
  | 'transfers'
  | 'discharged'
  | 'calendar'
  | 'occupancy-report'
  | 'settings'
  | 'active-admissions'
  | 'assessment-schedule'
  | 'admission-analytics'
  | 'notification-preferences'

export default function Page() {
  const [page, setPage] = useState<PageId>('dashboard')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [readmitPrefill, setReadmitPrefill] = useState<Record<string, string> | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // ── Notification sound
  const prevUnreadCount = useRef<number>(0)
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length
    if (unread > prevUnreadCount.current && prevUnreadCount.current !== -1) {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1)
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3)
      } catch {}
    }
    prevUnreadCount.current = unread
  }, [notifications])

  // ── Load data
  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [pRes, tRes, nRes] = await Promise.all([fetchAllPatients(), fetchTransfers(), fetchNotifications()])
      if (pRes.error) throw new Error(pRes.error.message)
      if (pRes.data) setPatients(pRes.data.map(mapDbPatientToUi))
      if (tRes.data) setTransfers(tRes.data.map(mapDbTransferToUi))
      if (nRes.data) setNotifications(nRes.data.map(mapDbNotificationToUi))
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Real-time
  useEffect(() => {
    const channel = supabase.channel('realtime-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admissions' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData])

  // ── Pull to refresh
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    let startY = 0
    const onTouchStart = (e: TouchEvent) => { startY = e.touches[0].clientY }
    const onTouchEnd = async (e: TouchEvent) => {
      const diff = e.changedTouches[0].clientY - startY
      if (diff > 80 && el.scrollTop === 0) {
        setRefreshing(true)
        await loadData()
        setRefreshing(false)
      }
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => { el.removeEventListener('touchstart', onTouchStart); el.removeEventListener('touchend', onTouchEnd) }
  }, [loadData])

  const refreshPatient = useCallback(async (patientId: string) => {
    const { data } = await fetchPatientById(patientId)
    if (data) setPatients(prev => prev.map(p => p.id === patientId ? mapDbPatientToUi(data) : p))
  }, [])

  // ── Toast with action support
  const addToast = useCallback((type: ToastType, title: string, message?: string, action?: { label: string; onClick: () => void }) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, type, title, message, action }])
  }, [])
  const dismissToast = useCallback((id: string) => { setToasts(prev => prev.filter(t => t.id !== id)) }, [])

  // ── Navigation
  function navigate(p: string) { setPage(p as PageId); if (p !== 'patient-detail') setSelectedPatientId(null); setSidebarOpen(false) }
  function viewPatient(id: string) { setSelectedPatientId(id); setPage('patient-detail') }

  // ── Admission
  async function handleNewAdmission(partial: Partial<Patient>) {
    const codes = await fetchAllPatientCodes()
    const patientCode = getNextPatientCode(codes)
    const admissionDate = partial.admissionDate ?? new Date().toISOString().split('T')[0]
    const subCategory = partial.currentSubStatus ?? null
    const { patient: newPatient, admission, error } = await admitNewPatient(
      { patient_code: patientCode, full_name: partial.name ?? '', date_of_birth: partial.dob ?? '', gender: partial.gender ?? '', phone: partial.phone ?? null, emergency_contact_name: partial.emergencyContactName ?? null, emergency_contact_phone: partial.emergencyContactPhone ?? null, address: partial.address ?? null, treating_doctor: partial.treatingDoctor ?? null },
      { admission_type: (partial.admissionType === 'Discharged' ? 'Independent' : partial.admissionType) ?? 'Independent', sub_category: subCategory, admission_date: admissionDate, discharge_date: null, discharge_reason: null, status: 'Active', admitted_by: partial.admittedBy ?? null, notes: null }
    )
    if (error || !newPatient) { addToast('error', 'Admission failed', error?.message ?? 'Unknown error'); return }
    const billingEnd = new Date(admissionDate); billingEnd.setDate(billingEnd.getDate() + 30)
    await addBillingPeriod({ patient_id: newPatient.id, admission_id: admission?.id ?? '', period_label: 'Period 1', from_date: admissionDate, to_date: billingEnd.toISOString().split('T')[0], sub_category: subCategory, amount: 30000, status: 'Pending' })
    const assessmentDue = new Date(admissionDate); assessmentDue.setDate(assessmentDue.getDate() + 7)
    await insertNotification({ patient_id: newPatient.id, type: 'Assessment Due', message: `First capacity assessment due for ${partial.name} (${patientCode})`, due_date: assessmentDue.toISOString().split('T')[0] })
    addToast('success', 'Patient admitted', `${partial.name} (${patientCode})`)
    setReadmitPrefill(undefined); await loadData(); setPage('all-patients')
  }

  function updatePatient(updated: Patient) { setPatients(prev => prev.map(p => p.id === updated.id ? updated : p)) }

  function handleReadmit(p: Patient) {
    setReadmitPrefill({ fullName: p.name, dob: p.dob, gender: p.gender, phone: p.phone, emergencyContact: p.emergencyContactName, emergencyPhone: p.emergencyContactPhone, address: p.address, doctor: p.treatingDoctor })
    navigate('new-admission')
  }

  function addTransfer(t: Transfer) { setTransfers(prev => [t, ...prev]) }

  // ── Notifications
  async function markRead(id: string) { setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)); await markNotificationRead(id) }
  async function markAllRead() { setNotifications(prev => prev.map(n => ({ ...n, read: true }))); await markAllNotificationsRead() }

  const selectedPatient = patients.find(p => p.id === selectedPatientId) ?? null

  function getBreadcrumbs() {
    if (page === 'patient-detail' && selectedPatient) return [{ label: 'All Patients', pageId: 'all-patients' }, { label: selectedPatient.name }]
    return []
  }

  // ── Page color for header
  function getPageColor(): string {
    switch (page) {
      case 'dashboard': return '#34C759'
      case 'all-patients': case 'active-admissions': case 'new-admission': case 'patient-detail': return '#007AFF'
      case 'capacity-assessments': case 'assessment-schedule': return '#5856D6'
      case 'calendar': return '#FF9500'
      case 'occupancy-report': case 'admission-analytics': return '#007AFF'
      case 'renewals-due': return '#FF9500'
      case 'discharged': return '#8E8E93'
      case 'transfers': return '#007AFF'
      case 'settings': case 'notification-preferences': return '#8E8E93'
      default: return '#007AFF'
    }
  }

  function renderPage() {
    if (loading) return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
          <p className="text-[14px] text-[#8E8E93]">Loading...</p>
        </div>
      </div>
    )
    if (error) return (
      <div className="flex items-center justify-center h-full">
        <div className="ios-card p-8 max-w-sm text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#FF3B30]/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#FF3B30]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-[15px] font-semibold text-[#000000]">Something went wrong</p>
          <p className="text-[13px] text-[#8E8E93]">{error}</p>
          <button onClick={loadData} className="px-5 py-2.5 text-[14px] bg-[#007AFF] text-white rounded-xl font-medium active:opacity-80">Retry</button>
        </div>
      </div>
    )
    switch (page) {
      case 'dashboard': return <Dashboard patients={patients} onNavigate={navigate} />
      case 'all-patients': return <AllPatients patients={patients} onViewPatient={viewPatient} onNewAdmission={() => navigate('new-admission')} />
      case 'patient-detail': return selectedPatient ? (
        <PatientDetail patient={selectedPatient} onBack={() => { loadData(); navigate('all-patients') }} onNavigate={navigate} onAddToast={addToast} onUpdatePatient={updatePatient} onRefreshPatient={refreshPatient} />
      ) : <div className="p-6 text-[#8E8E93] text-[14px]">Patient not found.</div>
      case 'new-admission': return <NewAdmission onSubmit={handleNewAdmission} prefill={readmitPrefill} />
      case 'capacity-assessments': case 'assessment-schedule': return <CapacityAssessments patients={patients} onViewPatient={viewPatient} onAddToast={addToast} onUpdatePatient={updatePatient} onRefreshData={loadData} />
      case 'renewals-due': return <RenewalsDue patients={patients} onViewPatient={viewPatient} onAddToast={addToast} onUpdatePatient={updatePatient} onRefreshData={loadData} />
      case 'transfers': return <Transfers transfers={transfers} patients={patients} onAddTransfer={addTransfer} onAddToast={addToast} onRefreshData={loadData} />
      case 'discharged': return <Discharged patients={patients} onViewPatient={viewPatient} onReadmit={handleReadmit} onAddToast={addToast} />
      case 'calendar': return <CalendarPage patients={patients} onViewPatient={viewPatient} />
      case 'occupancy-report': case 'admission-analytics': return <OccupancyReport patients={patients} />
      case 'active-admissions': return <AllPatients patients={patients.filter(p => p.admissionType !== 'Discharged')} onViewPatient={viewPatient} onNewAdmission={() => navigate('new-admission')} />
      case 'notification-preferences': return <Settings onAddToast={addToast} initialSection="Notification Rules" />
      case 'settings': return <Settings onAddToast={addToast} />
      default: return null
    }
  }

  // Mobile bottom tabs
  const bottomTabs = [
    { id: 'dashboard' as PageId, icon: <LayoutDashboard className="w-5 h-5" />, label: 'Home' },
    { id: 'all-patients' as PageId, icon: <Users className="w-5 h-5" />, label: 'Patients' },
    { id: 'calendar' as PageId, icon: <Calendar className="w-5 h-5" />, label: 'Calendar' },
    { id: 'settings' as PageId, icon: <SettingsIcon className="w-5 h-5" />, label: 'More' },
  ]

  return (
    <div className="flex h-screen bg-[#F2F2F7] overflow-hidden font-sans">
      <Sidebar activePage={page as PageId} onNavigate={navigate} onSearch={setSearchQuery} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} patients={patients} onViewPatient={viewPatient} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header pageId={page} breadcrumbs={getBreadcrumbs()} notifications={notifications} onBellClick={() => setNotifOpen(true)} onNavigate={navigate} onMenuClick={() => setSidebarOpen(true)} accentColor={getPageColor()} />

        {/* Pull to refresh indicator */}
        {refreshing && (
          <div className="flex justify-center py-2">
            <div className="w-5 h-5 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <main ref={mainRef} className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {renderPage()}
        </main>

        {/* Mobile bottom tab bar */}
        <div className="fixed bottom-0 left-0 right-0 lg:hidden ios-blur border-t border-[rgba(60,60,67,0.1)] z-30 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around h-[50px] max-w-md mx-auto">
            {bottomTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => navigate(tab.id)}
                className={cn('flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center',
                  page === tab.id || (tab.id === 'all-patients' && ['patient-detail', 'new-admission'].includes(page))
                    ? 'text-[#007AFF]' : 'text-[#8E8E93]'
                )}
              >
                {tab.icon}
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <NotificationDrawer open={notifOpen} notifications={notifications} onClose={() => setNotifOpen(false)} onMarkRead={markRead} onMarkAllRead={markAllRead} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <OnboardingTooltip />
    </div>
  )
}
