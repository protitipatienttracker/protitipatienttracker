// ─── Date / Format Utilities ─────────────────────────────────────────────────

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function daysBetween(from: string, to?: string): number {
  const toDate = to ? new Date(to) : new Date()
  return Math.floor((toDate.getTime() - new Date(from).getTime()) / 86400000)
}

export function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export function daysAgo(n: number): string {
  return daysFromNow(-n)
}

export const TODAY = new Date()

// ─── Shared App Types (UI layer) ─────────────────────────────────────────────

export type AdmissionType = 'Independent' | 'High Support' | 'Minor' | 'Discharged'
export type PatientStatus = 'Action Needed' | 'Due Soon' | 'On Track' | 'Upcoming' | 'Discharged'
export type AssessmentResult = 'Pass' | 'Fail'
export type NoteType = 'Clinical' | 'Administrative' | 'Legal'
export type DischargeReason = 'Capacity Regained' | 'Voluntary' | 'Clinical Decision'

export interface Assessment {
  id: string
  date: string
  conductedBy: string
  result: AssessmentResult
  notes: string
  nextDue: string
}

export interface AdmissionEpisode {
  id: string
  type: AdmissionType
  subType: string
  startDate: string
  endDate: string | null
  reasonForEnd: string
  duration: number | null
}

export interface Note {
  id: string
  date: string
  author: string
  text: string
  type: NoteType
}

export interface Patient {
  id: string
  patientCode: string
  name: string
  age: number
  gender: string
  dob: string
  phone: string
  emergencyContactName: string
  emergencyContactPhone: string
  address: string
  admittedBy: string
  treatingDoctor: string
  admissionType: AdmissionType
  admissionDate: string
  hsStartDate: string        // date current HS/CHS sub-category began (for renewal/CA scheduling)
  hsOriginDate: string       // date HS originally began (for milestone boundary display)
  currentSubStatus: string
  daysAdmitted: number
  nextActionDue: string
  nextActionType: string
  status: PatientStatus
  statusReason: string
  assessments: Assessment[]
  admissionHistory: AdmissionEpisode[]
  notes: Note[]
  patientTransfers: { id: string; date: string; fromType: string; toType: string; reason: string }[]
  dischargeDate?: string
  dischargeReason?: DischargeReason
  totalStay?: string
  activeAdmissionId?: string
}

export interface Transfer {
  id: string
  date: string
  patientName: string
  patientId: string     // patient UUID
  patientCode: string
  fromType: string
  toType: string
  reason: string
  triggeredBy: string
  notes: string
}

export interface Notification {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message: string
  time: string
  read: boolean
  patientId?: string
}

// ─── Staff / Doctors ─────────────────────────────────────────────────────────

export const initialPatients: Patient[] = []
export const initialTransfers: Transfer[] = []
export const initialNotifications: Notification[] = []

export const DOCTORS = ['Dr. Rajan Pillai', 'Dr. Anand Krishnan', 'Dr. Pradeep Nair']

export const initialStaff = [
  { id: 'S002', name: 'Dr. Rajan Pillai', role: 'Psychiatrist', email: 'rajan.pillai@caretrack.in', status: 'Active' },
  { id: 'S003', name: 'Dr. Anand Krishnan', role: 'Psychiatrist', email: 'anand.krishnan@caretrack.in', status: 'Active' },
  { id: 'S004', name: 'Dr. Pradeep Nair', role: 'Consultant', email: 'pradeep.nair@caretrack.in', status: 'Active' },
  { id: 'S005', name: 'Kavitha Menon', role: 'Clinical Coordinator', email: 'kavitha.menon@caretrack.in', status: 'Active' },
  { id: 'S006', name: 'Sujatha Varma', role: 'Admin Staff', email: 'sujatha.varma@caretrack.in', status: 'Inactive' },
]

// ─── DB → UI Mappers ─────────────────────────────────────────────────────────

import type { DbPatient, DbAdmission, DbTransfer, DbNotification, DbAssessment, DbNote } from './supabase'
import { getDaysAdmitted, getNextRenewalDate, getNextAssessmentDate, getDaysUntil } from './db'

function mapPatientStatus(
  admissionType: AdmissionType,
  daysAdmitted: number,
  subCategory: string | null,
  lastAssessmentDate: string | null,
  admissionDate: string,
): { status: PatientStatus; reason: string } {
  if (admissionType === 'Discharged') return { status: 'Discharged', reason: '' }
  if (admissionType === 'Minor') return { status: 'On Track', reason: '' }
  if (admissionType === 'Independent') return { status: 'On Track', reason: '' }
  if (admissionType === 'High Support') {
    const renewal = getNextRenewalDate(admissionDate, subCategory)
    const daysUntilRenewal = getDaysUntil(renewal)
    if (daysUntilRenewal < 0) return { status: 'Action Needed', reason: `${subCategory} renewal overdue by ${Math.abs(daysUntilRenewal)}d` }
    if (daysUntilRenewal <= 3) return { status: 'Due Soon', reason: `${subCategory} renewal due in ${daysUntilRenewal}d` }
    if (daysUntilRenewal <= 7) return { status: 'Upcoming', reason: `${subCategory} renewal in ${daysUntilRenewal}d` }
    if (subCategory && subCategory.startsWith('CHS')) {
      const effectiveLastCA = lastAssessmentDate && lastAssessmentDate > admissionDate
        ? lastAssessmentDate
        : admissionDate
      const nextAssess = getNextAssessmentDate(admissionDate, effectiveLastCA, admissionType, subCategory)
      const daysUntilAssess = getDaysUntil(nextAssess)
      if (daysUntilAssess < 0) return { status: 'Action Needed', reason: `CA overdue by ${Math.abs(daysUntilAssess)}d` }
      if (daysUntilAssess <= 2) return { status: 'Due Soon', reason: `CA due in ${daysUntilAssess}d` }
      if (daysUntilAssess <= 7) return { status: 'Upcoming', reason: `CA due in ${daysUntilAssess}d` }
    }
  }
  return { status: 'On Track', reason: '' }
}

export function mapDbPatientToUi(dbPatient: DbPatient): Patient {
  const admissions = dbPatient.admissions ?? []
  const activeAdmission = admissions.find(a => a.status === 'Active')
  const latestAdmission = admissions[0] // may be discharged

  const assessments: Assessment[] = (dbPatient.capacity_assessments ?? [])
    .sort((a, b) => new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime())
    .map(a => ({
      id: a.id,
      date: a.assessment_date,
      conductedBy: a.assessed_by,
      result: a.result,
      notes: a.notes ?? '',
      nextDue: a.next_assessment_due ?? '',
    }))

  const notes: Note[] = (dbPatient.clinical_notes ?? [])
    .sort((a, b) => new Date(b.note_date).getTime() - new Date(a.note_date).getTime())
    .map(n => ({
      id: n.id,
      date: n.note_date,
      author: n.author ?? 'Unknown',
      text: n.content,
      type: (n.note_type ?? 'Clinical') as NoteType,
    }))

  const sortedTransfers = (dbPatient.transfers ?? [])
    .sort((a, b) => new Date(a.transfer_date).getTime() - new Date(b.transfer_date).getTime())

  const admissionHistory: AdmissionEpisode[] = admissions
    .sort((a, b) => new Date(a.admission_date).getTime() - new Date(b.admission_date).getTime())
    .map(a => {
      // Use the fromType of the earliest transfer for this admission to get the original type
      const firstTransfer = sortedTransfers.find(t => t.from_admission_id === a.id || t.to_admission_id === a.id)
      const originalType: AdmissionType = firstTransfer
        ? firstTransfer.from_type as AdmissionType
        : a.admission_type as AdmissionType
      return {
        id: a.id,
        type: (a.status === 'Discharged' ? 'Discharged' : originalType) as AdmissionType,
        subType: a.sub_category ?? a.admission_type,
        startDate: a.admission_date,
        endDate: a.discharge_date,
        reasonForEnd: a.discharge_reason ?? '',
        duration: a.discharge_date
          ? Math.floor((new Date(a.discharge_date).getTime() - new Date(a.admission_date).getTime()) / 86400000)
          : null,
      }
    })

  const patientTransfers = sortedTransfers.map(t => ({
      id: t.id,
      date: t.transfer_date,
      fromType: t.from_type ?? '',
      toType: t.to_type ?? '',
      reason: t.reason ?? '',
    }))

  const isActive = !!activeAdmission
  const admissionType: AdmissionType = isActive
    ? activeAdmission!.admission_type
    : 'Discharged'
  const admissionDate = activeAdmission?.admission_date ?? latestAdmission?.admission_date ?? ''
  const subCategory = activeAdmission?.sub_category ?? null
  const daysAdmitted = admissionDate ? getDaysAdmitted(admissionDate) : 0

  // hsStartDate: date the current HS/CHS sub-category began.
  // For patients shifted from Independent → HS: use that transfer date.
  // For patients admitted directly as HS: use admissionDate.
  // For CHS sub-category shifts: use the transfer date into the current sub-category.
  const currentSubCat = activeAdmission?.sub_category ?? null
  const transferIntoCurrentSub = patientTransfers
    .filter(t => t.toType === currentSubCat)
    .slice(-1)[0]
  const transferFromIndependent = patientTransfers
    .filter(t => t.fromType === 'Independent' && (t.toType === 'HS ≤30 days' || t.toType.startsWith('CHS')))
    .slice(-1)[0]
  const hsStartDate = transferIntoCurrentSub?.date ?? transferFromIndependent?.date ?? admissionDate
  // hsOriginDate: the original date HS began (for milestone boundary calculations)
  // This is the admissionDate for direct HS admissions, or the Independent→HS transfer date
  const hsOriginDate = transferFromIndependent?.date ?? admissionDate

  const lastAssessmentDate = assessments.slice(-1)[0]?.date ?? null

  // Compute next action
  let nextActionDue = '—'
  let nextActionType = '—'
  if (isActive) {
    if (admissionType === 'High Support') {
      const renewal = getNextRenewalDate(hsStartDate, subCategory)
      nextActionDue = renewal.toISOString().split('T')[0]
      nextActionType = subCategory === 'HS ≤30 days' ? 'Shift to CHS' : 'CHS Renewal'
    } else if (admissionType === 'Minor') {
      // Compute 18th birthday
      const dob = new Date(dbPatient.date_of_birth)
      const eighteenth = new Date(dob)
      eighteenth.setFullYear(eighteenth.getFullYear() + 18)
      nextActionDue = eighteenth.toISOString().split('T')[0]
      nextActionType = 'Turns 18'
    }
  }

  const { status, reason: statusReason } = mapPatientStatus(admissionType, daysAdmitted, subCategory, lastAssessmentDate, hsStartDate)

  // Discharge info
  const dischargedAdmission = admissions.find(a => a.status === 'Discharged' && !activeAdmission)
    ?? (activeAdmission ? undefined : latestAdmission)
  const dischargeDate = dischargedAdmission?.discharge_date ?? undefined
  const totalStayDays = dischargeDate && admissionDate
    ? Math.floor((new Date(dischargeDate).getTime() - new Date(admissionDate).getTime()) / 86400000)
    : null

  return {
    id: dbPatient.id,
    patientCode: dbPatient.patient_code,
    name: dbPatient.full_name,
    age: getDaysAdmitted(dbPatient.date_of_birth) > 0
      ? Math.floor(getDaysAdmitted(dbPatient.date_of_birth) / 365)
      : 0,
    gender: dbPatient.gender,
    dob: dbPatient.date_of_birth,
    phone: dbPatient.phone ?? '',
    emergencyContactName: dbPatient.emergency_contact_name ?? '',
    emergencyContactPhone: dbPatient.emergency_contact_phone ?? '',
    address: dbPatient.address ?? '',
    admittedBy: activeAdmission?.admitted_by ?? latestAdmission?.admitted_by ?? '',
    treatingDoctor: dbPatient.treating_doctor ?? '',
    admissionType,
    admissionDate,
    hsStartDate,
    hsOriginDate,
    currentSubStatus: subCategory ?? admissionType,
    daysAdmitted: isActive ? daysAdmitted : 0,
    nextActionDue,
    nextActionType,
    status,
    statusReason,
    assessments,
    admissionHistory,
    notes,
    patientTransfers,
    dischargeDate,
    dischargeReason: dischargedAdmission?.discharge_reason as DischargeReason | undefined,
    totalStay: totalStayDays !== null ? `${totalStayDays} days` : undefined,
    activeAdmissionId: activeAdmission?.id,
  }
}

export function mapDbTransferToUi(t: DbTransfer): Transfer {
  return {
    id: t.id,
    date: t.transfer_date,
    patientName: t.patients?.full_name ?? 'Unknown',
    patientId: t.patient_id,
    patientCode: t.patients?.patient_code ?? '',
    fromType: t.from_type ?? '',
    toType: t.to_type ?? '',
    reason: t.reason ?? '',
    triggeredBy: t.triggered_by ?? '',
    notes: t.notes ?? '',
  }
}

export function mapDbNotificationToUi(n: DbNotification): Notification {
  const typeMap: Record<string, Notification['type']> = {
    'Renewal Due': 'error',
    'Assessment Due': 'warning',
    'Sub-Category Shift': 'info',
    'Minor Turning 18': 'warning',
    'Discharge': 'success',
    'New Admission': 'info',
  }
  const uiType = typeMap[n.type ?? ''] ?? 'info'
  const timeAgo = n.created_at
    ? formatRelativeTime(new Date(n.created_at))
    : ''
  return {
    id: n.id,
    type: uiType,
    title: n.type ?? 'Notification',
    message: n.message,
    time: timeAgo,
    read: n.is_read,
    patientId: n.patient_id ?? undefined,
  }
}

function formatRelativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) !== 1 ? 's' : ''} ago`
  const days = Math.floor(diff / 86400)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}
