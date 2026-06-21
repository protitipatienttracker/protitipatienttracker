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
export type BillingStatus = 'Paid' | 'Pending'
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

export interface BillingPeriod {
  id: string
  period: string
  from: string
  to: string
  subCategory: string
  amount: number
  status: BillingStatus
}

export interface Patient {
  id: string            // UUID from Supabase patients.id
  patientCode: string   // e.g. PT-001
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
  currentSubStatus: string
  daysAdmitted: number
  nextActionDue: string
  nextActionType: string
  status: PatientStatus
  assessments: Assessment[]
  admissionHistory: AdmissionEpisode[]
  notes: Note[]
  billingPeriods: BillingPeriod[]
  dischargeDate?: string
  dischargeReason?: DischargeReason
  totalStay?: string
  // raw DB IDs needed for writes
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

export const DOCTORS = ['Arjun Sathe', 'Dr. Rajan Pillai', 'Dr. Anand Krishnan', 'Dr. Pradeep Nair']

export const initialStaff = [
  { id: 'S001', name: 'Arjun Sathe', role: 'Psychiatrist', email: 'arjun.sathe@protiti.in', status: 'Active' },
  { id: 'S002', name: 'Dr. Rajan Pillai', role: 'Psychiatrist', email: 'rajan.pillai@caretrack.in', status: 'Active' },
  { id: 'S003', name: 'Dr. Anand Krishnan', role: 'Psychiatrist', email: 'anand.krishnan@caretrack.in', status: 'Active' },
  { id: 'S004', name: 'Dr. Pradeep Nair', role: 'Consultant', email: 'pradeep.nair@caretrack.in', status: 'Active' },
  { id: 'S005', name: 'Kavitha Menon', role: 'Clinical Coordinator', email: 'kavitha.menon@caretrack.in', status: 'Active' },
  { id: 'S006', name: 'Sujatha Varma', role: 'Admin Staff', email: 'sujatha.varma@caretrack.in', status: 'Inactive' },
]

// ─── DB → UI Mappers ─────────────────────────────────────────────────────────

import type { DbPatient, DbAdmission, DbTransfer, DbNotification, DbAssessment, DbBillingPeriod, DbNote } from './supabase'
import { getDaysAdmitted, getNextRenewalDate, getNextAssessmentDate, getDaysUntil } from './db'

function mapPatientStatus(
  admissionType: AdmissionType,
  daysAdmitted: number,
  subCategory: string | null,
  lastAssessmentDate: string | null,
  admissionDate: string,
): PatientStatus {
  if (admissionType === 'Discharged') return 'Discharged'
  if (admissionType === 'Minor') return 'On Track'
  if (admissionType === 'High Support') {
    const renewal = getNextRenewalDate(admissionDate, subCategory)
    const daysUntilRenewal = getDaysUntil(renewal)
    if (daysUntilRenewal < 0) return 'Action Needed'
    if (daysUntilRenewal <= 3) return 'Due Soon'
    if (daysUntilRenewal <= 7) return 'Upcoming'
  }
  // Assessment status
  const nextAssess = getNextAssessmentDate(admissionDate, lastAssessmentDate)
  const daysUntilAssess = getDaysUntil(nextAssess)
  if (daysUntilAssess < 0) return 'Action Needed'
  if (daysUntilAssess <= 2) return 'Due Soon'
  if (daysUntilAssess <= 7) return 'Upcoming'
  return 'On Track'
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

  const billingPeriods: BillingPeriod[] = (dbPatient.billing_periods ?? [])
    .sort((a, b) => new Date(a.from_date).getTime() - new Date(b.from_date).getTime())
    .map((b, i) => ({
      id: b.id,
      period: b.period_label ?? `Period ${i + 1}`,
      from: b.from_date,
      to: b.to_date,
      subCategory: b.sub_category ?? '',
      amount: b.amount ?? 0,
      status: b.status,
    }))

  const admissionHistory: AdmissionEpisode[] = admissions
    .sort((a, b) => new Date(a.admission_date).getTime() - new Date(b.admission_date).getTime())
    .map(a => ({
      id: a.id,
      type: (a.status === 'Discharged' ? 'Discharged' : a.admission_type) as AdmissionType,
      subType: a.sub_category ?? a.admission_type,
      startDate: a.admission_date,
      endDate: a.discharge_date,
      reasonForEnd: a.discharge_reason ?? '',
      duration: a.discharge_date
        ? Math.floor((new Date(a.discharge_date).getTime() - new Date(a.admission_date).getTime()) / 86400000)
        : null,
    }))

  const isActive = !!activeAdmission
  const admissionType: AdmissionType = isActive
    ? activeAdmission!.admission_type
    : 'Discharged'
  const admissionDate = activeAdmission?.admission_date ?? latestAdmission?.admission_date ?? ''
  const subCategory = activeAdmission?.sub_category ?? null
  const daysAdmitted = admissionDate ? getDaysAdmitted(admissionDate) : 0

  const lastAssessmentDate = assessments.slice(-1)[0]?.date ?? null

  // Compute next action
  let nextActionDue = '—'
  let nextActionType = '—'
  if (isActive) {
    if (admissionType === 'High Support') {
      const renewal = getNextRenewalDate(admissionDate, subCategory)
      nextActionDue = renewal.toISOString().split('T')[0]
      nextActionType = 'Shift to CHS'
    } else if (admissionType === 'Independent') {
      const assess = getNextAssessmentDate(admissionDate, lastAssessmentDate)
      nextActionDue = assess.toISOString().split('T')[0]
      nextActionType = 'Capacity Assessment'
    } else if (admissionType === 'Minor') {
      // Compute 18th birthday
      const dob = new Date(dbPatient.date_of_birth)
      const eighteenth = new Date(dob)
      eighteenth.setFullYear(eighteenth.getFullYear() + 18)
      nextActionDue = eighteenth.toISOString().split('T')[0]
      nextActionType = 'Turns 18'
    }
  }

  const status = mapPatientStatus(admissionType, daysAdmitted, subCategory, lastAssessmentDate, admissionDate)

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
    currentSubStatus: subCategory ?? admissionType,
    daysAdmitted: isActive ? daysAdmitted : 0,
    nextActionDue,
    nextActionType,
    status,
    assessments,
    admissionHistory,
    notes,
    billingPeriods,
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
