import { supabase } from './supabase'
import type {
  DbPatient, DbAdmission, DbAssessment,
  DbTransfer, DbNote, DbNotification,
} from './supabase'

// ─── Business Logic Utilities ────────────────────────────────────────────────

// CHS milestone boundaries (days from original HS admission date)
// HS ≤30 days   → day 1–30     → shift on day 31
// CHS >30 days  → day 31–90    → shift on day 91
// CHS >90 days  → day 91–120   → shift on day 121
// CHS >120 days → day 121–180  → shift on day 181
// CHS >180 days → recurring every 181 days
const CHS_MILESTONES: Record<string, number> = {
  'HS ≤30 days':   30,
  'CHS >30 days':   90,
  'CHS >90 days':  120,
  'CHS >120 days': 180,
  'CHS >180 days': 361, // 180 + 181
}

export function getNextRenewalDate(admissionDate: string, subCategory: string | null): Date {
  const start = new Date(admissionDate)
  const days = CHS_MILESTONES[subCategory ?? ''] ?? 30
  const renewal = new Date(start)
  renewal.setDate(renewal.getDate() + days)
  return renewal
}

// HS (≤30 days): weekly (7 days) | CHS / Independent: fortnightly (14 days)
export function getNextAssessmentDate(
  admissionDate: string,
  lastAssessmentDate: string | null,
  admissionType?: string,
  subCategory?: string | null,
): Date {
  const base = lastAssessmentDate ? new Date(lastAssessmentDate) : new Date(admissionDate)
  const isHS = admissionType === 'High Support' && (subCategory === 'HS ≤30 days' || !subCategory)
  const intervalDays = isHS ? 7 : 14
  const next = new Date(base)
  next.setDate(next.getDate() + intervalDays)
  return next
}

export function getDaysUntil(targetDate: Date | string): number {
  const d = typeof targetDate === 'string' ? new Date(targetDate) : targetDate
  return Math.floor((d.getTime() - Date.now()) / 86400000)
}

export function getDaysAdmitted(admissionDate: string): number {
  return Math.floor((Date.now() - new Date(admissionDate).getTime()) / 86400000)
}

export function getSubCategoryFromDays(daysAdmitted: number): string {
  if (daysAdmitted <= 30)  return 'HS ≤30 days'
  if (daysAdmitted <= 90)  return 'CHS >30 days'
  if (daysAdmitted <= 120) return 'CHS >90 days'
  if (daysAdmitted <= 180) return 'CHS >120 days'
  return 'CHS >180 days'
}

export function getNextMilestoneSubCategory(current: string | null): string {
  const order = ['HS ≤30 days', 'CHS >30 days', 'CHS >90 days', 'CHS >120 days', 'CHS >180 days']
  const idx = order.indexOf(current ?? '')
  if (idx < 0) return 'CHS >30 days'
  if (idx >= order.length - 1) return 'CHS >180 days' // recurring
  return order[idx + 1]
}

// Re-admission rule: if discharged from HS and re-admitted within 7 days,
// resume the same sub-category. Otherwise restart from HS ≤30 days.
export function getReadmissionSubCategory(
  lastDischargeDate: string | null,
  lastSubCategory: string | null,
): string {
  if (!lastDischargeDate || !lastSubCategory) return 'HS ≤30 days'
  const daysSinceDischarge = Math.floor(
    (Date.now() - new Date(lastDischargeDate).getTime()) / 86400000
  )
  if (daysSinceDischarge <= 7) return lastSubCategory
  return 'HS ≤30 days'
}

// ─── Bulk CA Notification Generator ─────────────────────────────────────────

function addDaysToDate(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// Generate HS notifications when a patient is shifted to HS mid-admission
export async function generateHsShiftNotifications(
  patientId: string,
  patientName: string,
  patientCode: string,
  shiftDate: string,
) {
  const notifications = []
  for (let week = 1; week <= 4; week++) {
    const due = addDaysToDate(shiftDate, week * 7)
    notifications.push({
      patient_id: patientId,
      type: 'Assessment Due',
      message: `Week ${week} CA due for ${patientName} (${patientCode}) — HS ≤30 days (shifted ${shiftDate})`,
      due_date: due,
    })
  }
  notifications.push({
    patient_id: patientId,
    type: 'Sub-Category Shift',
    message: `${patientName} (${patientCode}) reaches day 31 of HS — review for shift to CHS`,
    due_date: addDaysToDate(shiftDate, 31),
  })
  await Promise.all(notifications.map(n => supabase.from('notifications').insert([n])))
}

export async function generateAdmissionNotifications(
  patientId: string,
  patientName: string,
  patientCode: string,
  admissionType: 'Independent' | 'High Support' | 'Minor',
  admissionDate: string,
  dob?: string,
) {
  const notifications: { patient_id: string; type: string; message: string; due_date: string }[] = []

  if (admissionType === 'High Support') {
    // 4 weekly CAs on day 7, 14, 21, 28
    for (let week = 1; week <= 4; week++) {
      const due = addDaysToDate(admissionDate, week * 7)
      notifications.push({
        patient_id: patientId,
        type: 'Assessment Due',
        message: `Week ${week} capacity assessment due for ${patientName} (${patientCode}) — HS ≤30 days`,
        due_date: due,
      })
    }
    // Notify on day 31 to shift to CHS
    notifications.push({
      patient_id: patientId,
      type: 'Sub-Category Shift',
      message: `${patientName} (${patientCode}) reaches day 31 — review for shift to Continuous High Support`,
      due_date: addDaysToDate(admissionDate, 31),
    })
  } else if (admissionType === 'Minor' && dob) {
    const dobDate = new Date(dob)
    const eighteenth = new Date(dobDate)
    eighteenth.setFullYear(eighteenth.getFullYear() + 18)
    const eighteenthStr = eighteenth.toISOString().split('T')[0]
    notifications.push({
      patient_id: patientId,
      type: 'Minor Turning 18',
      message: `${patientName} (${patientCode}) turns 18 — capacity assessment required`,
      due_date: eighteenthStr,
    })
  }

  // Insert all in parallel
  await Promise.all(
    notifications.map(n =>
      supabase.from('notifications').insert([n])
    )
  )
}

export function getNextPatientCode(existingCodes: string[]): string {
  const nums = existingCodes.map(c => parseInt(c.replace('PT-', ''))).filter(Boolean)
  const next = Math.max(...nums, 0) + 1
  return `PT-${String(next).padStart(3, '0')}`
}

export function calcAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000))
}

// ─── Fetch All Patients (with active admission joined) ──────────────────────

export async function fetchAllPatients(facility: string) {
  const { data, error } = await supabase
    .from('patients')
    .select(`
      *,
      admissions (
        id, admission_type, sub_category, admission_date,
        discharge_date, status, discharge_reason, admitted_by, notes
      ),
      capacity_assessments (*),
      transfers (*)
    `)
    .eq('facility', facility)
    .order('created_at', { ascending: false })
  return { data: data as DbPatient[] | null, error }
}

// ─── Fetch Single Patient (full detail) ──────────────────────────────────────

export async function fetchPatientById(patientId: string) {
  const { data, error } = await supabase
    .from('patients')
    .select(`
      *,
      admissions (*),
      capacity_assessments (*),
      clinical_notes (*),
      transfers (*)
    `)
    .eq('id', patientId)
    .single()
  return { data: data as DbPatient | null, error }
}

// ─── Admit New Patient ────────────────────────────────────────────────────────

export async function admitNewPatient(
  patientData: Omit<DbPatient, 'id' | 'created_at' | 'admissions' | 'capacity_assessments' | 'clinical_notes'>,
  admissionData: Omit<DbAdmission, 'id' | 'patient_id' | 'created_at' | 'patients'>
) {
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .insert([patientData])
    .select()
    .single()
  if (patientError || !patient) return { error: patientError }

  const { data: admission, error: admissionError } = await supabase
    .from('admissions')
    .insert([{ ...admissionData, patient_id: patient.id }])
    .select()
    .single()

  return { patient: patient as DbPatient, admission: admission as DbAdmission, error: admissionError }
}

// ─── Capacity Assessment ──────────────────────────────────────────────────────

export async function addCapacityAssessment(data: Omit<DbAssessment, 'id' | 'created_at' | 'patients'>) {
  const { data: result, error } = await supabase
    .from('capacity_assessments')
    .insert([data])
    .select()
    .single()
  return { data: result as DbAssessment | null, error }
}

// ─── Discharge Patient ────────────────────────────────────────────────────────

export async function dischargePatient(admissionId: string, dischargeReason: string, dischargeDate: string) {
  const { data, error } = await supabase
    .from('admissions')
    .update({ status: 'Discharged', discharge_date: dischargeDate, discharge_reason: dischargeReason })
    .eq('id', admissionId)
    .select()
    .single()
  return { data: data as DbAdmission | null, error }
}

// ─── Update Sub-Category ──────────────────────────────────────────────────────

function admissionTypeFromSubCategory(subCategory: string): string {
  if (subCategory === 'Independent') return 'Independent'
  if (subCategory === 'Minor') return 'Minor'
  return 'High Support' // HS ≤30 days, CHS >30 days, etc.
}

export async function updateSubCategory(admissionId: string, newSubCategory: string) {
  const { data, error } = await supabase
    .from('admissions')
    .update({
      sub_category: newSubCategory,
      admission_type: admissionTypeFromSubCategory(newSubCategory),
    })
    .eq('id', admissionId)
    .select()
    .single()
  return { data: data as DbAdmission | null, error }
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function fetchNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, patients(full_name, patient_code)')
    .order('is_read', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
  return { data: data as DbNotification[] | null, error }
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
  return { error }
}

export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
  return { error }
}

export async function insertNotification(data: {
  patient_id?: string
  type: string
  message: string
  due_date?: string
}) {
  const { data: result, error } = await supabase
    .from('notifications')
    .insert([data])
    .select()
    .single()
  return { data: result as DbNotification | null, error }
}

// ─── Clinical Notes ───────────────────────────────────────────────────────────

export async function addClinicalNote(data: Omit<DbNote, 'id' | 'created_at'>) {
  const { data: result, error } = await supabase
    .from('clinical_notes')
    .insert([data])
    .select()
    .single()
  return { data: result as DbNote | null, error }
}

// ─── Transfers ────────────────────────────────────────────────────────────────

export async function fetchTransfers() {
  const { data, error } = await supabase
    .from('transfers')
    .select('*, patients(full_name, patient_code)')
    .order('transfer_date', { ascending: false })
  return { data: data as DbTransfer[] | null, error }
}

export async function insertTransfer(data: Omit<DbTransfer, 'id' | 'created_at' | 'patients'>) {
  const { data: result, error } = await supabase
    .from('transfers')
    .insert([data])
    .select()
    .single()
  return { data: result as DbTransfer | null, error }
}

// ─── Fetch Active Admissions (for renewals / calendar) ───────────────────────

export async function fetchActiveAdmissions() {
  const { data, error } = await supabase
    .from('admissions')
    .select('*, patients(full_name, patient_code)')
    .eq('status', 'Active')
    .order('admission_date', { ascending: false })
  return { data: data as DbAdmission[] | null, error }
}

// ─── Fetch Discharged Admissions ──────────────────────────────────────────────

export async function fetchDischargedAdmissions() {
  const { data, error } = await supabase
    .from('admissions')
    .select('*, patients(*)')
    .eq('status', 'Discharged')
    .order('discharge_date', { ascending: false })
  return { data: data as (DbAdmission & { patients: DbPatient })[] | null, error }
}

// ─── Fetch All Patient Codes ──────────────────────────────────────────────────

export async function fetchAllPatientCodes(facility: string): Promise<string[]> {
  const { data } = await supabase
    .from('patients')
    .select('patient_code')
    .eq('facility', facility)
  return (data ?? []).map((r: { patient_code: string }) => r.patient_code)
}

// ─── Update Patient Field ─────────────────────────────────────────────────────

export async function updatePatientField(patientId: string, field: string, value: string) {
  const fieldMap: Record<string, string> = {
    'Phone': 'phone',
    'Address': 'address',
    'Emergency': 'emergency_contact_name',
    'Emergency Ph.': 'emergency_contact_phone',
    'Doctor': 'treating_doctor',
  }
  const dbField = fieldMap[field]
  if (!dbField) return { error: { message: 'Unknown field' } }
  const { error } = await supabase
    .from('patients')
    .update({ [dbField]: value })
    .eq('id', patientId)
  return { error }
}

// ─── Delete Patient (cascade all related data) ───────────────────────────────

export async function deletePatients(patientIds: string[]) {
  const tables = ['notifications', 'clinical_notes', 'capacity_assessments', 'transfers', 'admissions']
  for (const table of tables) {
    await supabase.from(table).delete().in('patient_id', patientIds)
  }
  const { error } = await supabase.from('patients').delete().in('id', patientIds)
  return { error }
}


export async function undoDischarge(admissionId: string) {
  const { data, error } = await supabase
    .from('admissions')
    .update({ status: 'Active', discharge_date: null, discharge_reason: null })
    .eq('id', admissionId)
    .select()
    .single()
  return { data: data as DbAdmission | null, error }
}

// ─── Staff Management ─────────────────────────────────────────────────────────

import type { DbStaff, DbSettings } from './supabase'

export async function fetchStaff() {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .order('created_at', { ascending: true })
  return { data: data as DbStaff[] | null, error }
}

export async function addStaffMember(data: Omit<DbStaff, 'id' | 'created_at'>) {
  const { data: result, error } = await supabase
    .from('staff')
    .insert([data])
    .select()
    .single()
  return { data: result as DbStaff | null, error }
}

export async function updateStaffStatus(staffId: string, status: 'Active' | 'Inactive') {
  const { data, error } = await supabase
    .from('staff')
    .update({ status })
    .eq('id', staffId)
    .select()
    .single()
  return { data: data as DbStaff | null, error }
}

export async function deleteStaffMember(staffId: string) {
  const { error } = await supabase
    .from('staff')
    .delete()
    .eq('id', staffId)
  return { error }
}

// ─── Settings (key-value store) ───────────────────────────────────────────────

export async function fetchSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
  return { data: data as DbSettings[] | null, error }
}

export async function upsertSetting(key: string, value: string) {
  const { data, error } = await supabase
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' })
    .select()
    .single()
  return { data: data as DbSettings | null, error }
}
