'use client'
import { useState, useCallback, useEffect } from 'react'
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

  // ── Load data from Supabase on mount ──────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pRes, tRes, nRes] = await Promise.all([
        fetchAllPatients(),
        fetchTransfers(),
        fetchNotifications(),
      ])
      if (pRes.error) throw new Error(pRes.error.message)
      if (pRes.data) setPatients(pRes.data.map(mapDbPatientToUi))
      if (tRes.data) setTransfers(tRes.data.map(mapDbTransferToUi))
      if (nRes.data) setNotifications(nRes.data.map(mapDbNotificationToUi))
    } catch (e: any) {
      console.error('Failed to load data:', e)
      setError(e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Real-time subscription ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('realtime-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admissions' }, () => { loadData() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => { loadData() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => { loadData() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadData])

  // ── Refresh a single patient ──────────────────────────────────────────────
  const refreshPatient = useCallback(async (patientId: string) => {
    const { data } = await fetchPatientById(patientId)
    if (data) {
      const mapped = mapDbPatientToUi(data)
      setPatients(prev => prev.map(p => p.id === patientId ? mapped : p))
    }
  }, [])

  // ── Toast helpers ─────────────────────────────────────────────────────────
  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, type, title, message }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Navigation ────────────────────────────────────────────────────────────
  function navigate(p: string) {
    setPage(p as PageId)
    if (p !== 'patient-detail') setSelectedPatientId(null)
    setSidebarOpen(false)
  }

  function viewPatient(id: string) {
    setSelectedPatientId(id)
    setPage('patient-detail')
  }

  // ── Patient mutations ─────────────────────────────────────────────────────
  async function handleNewAdmission(partial: Partial<Patient>) {
    const codes = await fetchAllPatientCodes()
    const patientCode = getNextPatientCode(codes)
    const admissionDate = partial.admissionDate ?? new Date().toISOString().split('T')[0]
    const subCategory = partial.currentSubStatus ?? null

    const { patient: newPatient, admission, error } = await admitNewPatient(
      {
        patient_code: patientCode,
        full_name: partial.name ?? '',
        date_of_birth: partial.dob ?? '',
        gender: partial.gender ?? '',
        phone: partial.phone ?? null,
        emergency_contact_name: partial.emergencyContactName ?? null,
        emergency_contact_phone: partial.emergencyContactPhone ?? null,
        address: partial.address ?? null,
        treating_doctor: partial.treatingDoctor ?? null,
      },
      {
        admission_type: (partial.admissionType === 'Discharged' ? 'Independent' : partial.admissionType) ?? 'Independent',
        sub_category: subCategory,
        admission_date: admissionDate,
        discharge_date: null,
        discharge_reason: null,
        status: 'Active',
        admitted_by: partial.admittedBy ?? null,
        notes: null,
      }
    )
    if (error || !newPatient) {
      addToast('error', 'Admission failed', error?.message ?? 'Unknown error')
      return
    }

    // Auto-generate first billing period
    const billingEnd = new Date(admissionDate)
    billingEnd.setDate(billingEnd.getDate() + 30)
    await addBillingPeriod({
      patient_id: newPatient.id,
      admission_id: admission?.id ?? '',
      period_label: 'Period 1',
      from_date: admissionDate,
      to_date: billingEnd.toISOString().split('T')[0],
      sub_category: subCategory,
      amount: 30000,
      status: 'Pending',
    })

    // Auto-generate first notification
    const assessmentDue = new Date(admissionDate)
    assessmentDue.setDate(assessmentDue.getDate() + 7)
    await insertNotification({
      patient_id: newPatient.id,
      type: 'Assessment Due',
      message: `First capacity assessment due for ${partial.name} (${patientCode})`,
      due_date: assessmentDue.toISOString().split('T')[0],
    })

    addToast('success', 'Patient admitted', `${partial.name} (${patientCode}) has been admitted successfully.`)
    setReadmitPrefill(undefined)
    await loadData()
    setPage('all-patients')
  }

  function updatePatient(updated: Patient) {
    setPatients(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  function handleReadmit(p: Patient) {
    setReadmitPrefill({
      fullName: p.name,
      dob: p.dob,
      gender: p.gender,
      phone: p.phone,
      emergencyContact: p.emergencyContactName,
      emergencyPhone: p.emergencyContactPhone,
      address: p.address,
      doctor: p.treatingDoctor,
    })
    navigate('new-admission')
  }

  function addTransfer(t: Transfer) {
    setTransfers(prev => [t, ...prev])
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  async function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await markNotificationRead(id)
  }
  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    await markAllNotificationsRead()
  }

  const selectedPatient = patients.find(p => p.id === selectedPatientId) ?? null

  // ── Breadcrumbs ───────────────────────────────────────────────────────────
  function getBreadcrumbs() {
    if (page === 'patient-detail' && selectedPatient) {
      return [
        { label: 'All Patients', pageId: 'all-patients' },
        { label: selectedPatient.name },
      ]
    }
    return []
  }

  // ── Page renderer ─────────────────────────────────────────────────────────
  function renderPage() {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-[#0D6E6E] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading...</p>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-red-200 p-8 max-w-sm text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Something went wrong</p>
              <p className="text-xs text-slate-500 mt-1">{error}</p>
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 text-sm bg-[#0D6E6E] text-white rounded-lg hover:bg-[#0A5858] font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }

    switch (page) {
      case 'dashboard':
        return <Dashboard patients={patients} onNavigate={navigate} />
      case 'all-patients':
        return (
          <AllPatients
            patients={patients}
            onViewPatient={viewPatient}
            onNewAdmission={() => navigate('new-admission')}
          />
        )
      case 'patient-detail':
        return selectedPatient ? (
          <PatientDetail
            patient={selectedPatient}
            onBack={() => { loadData(); navigate('all-patients') }}
            onNavigate={navigate}
            onAddToast={addToast}
            onUpdatePatient={updatePatient}
            onRefreshPatient={refreshPatient}
          />
        ) : (
          <div className="p-6 text-slate-500 text-sm">Patient not found.</div>
        )
      case 'new-admission':
        return (
          <NewAdmission
            onSubmit={handleNewAdmission}
            prefill={readmitPrefill}
          />
        )
      case 'capacity-assessments':
        return (
          <CapacityAssessments
            patients={patients}
            onViewPatient={viewPatient}
            onAddToast={addToast}
            onUpdatePatient={updatePatient}
            onRefreshData={loadData}
          />
        )
      case 'renewals-due':
        return (
          <RenewalsDue
            patients={patients}
            onViewPatient={viewPatient}
            onAddToast={addToast}
            onUpdatePatient={updatePatient}
            onRefreshData={loadData}
          />
        )
      case 'transfers':
        return (
          <Transfers
            transfers={transfers}
            patients={patients}
            onAddTransfer={addTransfer}
            onAddToast={addToast}
            onRefreshData={loadData}
          />
        )
      case 'discharged':
        return (
          <Discharged
            patients={patients}
            onViewPatient={viewPatient}
            onReadmit={handleReadmit}
            onAddToast={addToast}
          />
        )
      case 'calendar':
        return <CalendarPage patients={patients} onViewPatient={viewPatient} />
      case 'occupancy-report':
        return <OccupancyReport patients={patients} />
      case 'active-admissions':
        return (
          <AllPatients
            patients={patients.filter(p => p.admissionType !== 'Discharged')}
            onViewPatient={viewPatient}
            onNewAdmission={() => navigate('new-admission')}
          />
        )
      case 'assessment-schedule':
        return (
          <CapacityAssessments
            patients={patients}
            onViewPatient={viewPatient}
            onAddToast={addToast}
            onUpdatePatient={updatePatient}
            onRefreshData={loadData}
          />
        )
      case 'admission-analytics':
        return <OccupancyReport patients={patients} />
      case 'notification-preferences':
        return <Settings onAddToast={addToast} initialSection="Notification Rules" />
      case 'settings':
        return <Settings onAddToast={addToast} />
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar activePage={page as PageId} onNavigate={navigate} onSearch={setSearchQuery} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          pageId={page}
          breadcrumbs={getBreadcrumbs()}
          notifications={notifications}
          onBellClick={() => setNotifOpen(true)}
          onNavigate={navigate}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>

      <NotificationDrawer
        open={notifOpen}
        notifications={notifications}
        onClose={() => setNotifOpen(false)}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
