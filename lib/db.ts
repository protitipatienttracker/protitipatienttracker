import { supabase } from './supabase'
import type {
  DbPatient, DbAdmission, DbAssessment, DbBillingPeriod,
  DbTransfer, DbNote, DbNotification,
} from './supabase'

// ─── Business Logic Utilities ────────────────────────────────────────────────

export function getNextRenewalDate(admissionDate: string, subCategory: string | null): Date {
  const start = new Date(admissionDate)
  // High Support milestones (from admission date):
  // Initial (HS ≤30 days): day 1–30, renewal at day 30
  // Extended 1 (HS >30 days): day 31–120, renewal at day 120
  // Extended 2 (HS >120 days): day 121–240, renewal at day 240
  // Extended 3 (HS >240 days): day 241–420, renewal at day 420
  // Long-term (HS >420 days): day 421–600, renewal at day 600
  // Long-term recurring: every 180 days after
  const milestones: Record<string, number> = {
    'HS ≤30 days': 30,
    'HS >30 days': 120,
    'HS >120 days': 240,
    'HS >240 days': 420,
    'HS >420 days': 600,
    'HS >600 days': 780,
  }
  const days = milestones[subCategory ?? ''] ?? 30
  const renewal = new Date(start)
  renewal.setDate(renewal.getDate() + days)
  return renewal
}

export function getNextAssessmentDate(admissionDate: string, lastAssessmentDate: string | null): Date {
  const base = lastAssessmentDate ? new Date(lastAssessmentDate) : new Date(admissionDate)
  const daysAdmitted = Math.floor((Date.now() - new Date(admissionDate).getTime()) / 86400000)
  const intervalDays = daysAdmitted <= 30 ? 7 : 14
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
  if (daysAdmitted <= 30) return 'HS ≤30 days'
  if (daysAdmitted <= 120) return 'HS >30 days'
  if (daysAdmitted <= 240) return 'HS >120 days'
  if (daysAdmitted <= 420) return 'HS >240 days'
  if (daysAdmitted <= 600) return 'HS >420 days'
  return 'HS >600 days'
}

export function getNextMilestoneSubCategory(current: string | null): string {
  const order = ['HS ≤30 days', 'HS >30 days', 'HS >120 days', 'HS >240 days', 'HS >420 days', 'HS >600 days']
  const idx = order.indexOf(current ?? '')
  if (idx >= order.length - 1) return 'HS >600 days' // recurring
  return order[Math.min(idx + 1, order.length - 1)]
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

export async function fetchAllPatients() {
  const { data, error } = await supabase
    .from('patients')
    .select(`
      *,
      admissions (
        id, admission_type, sub_category, admission_date,
        discharge_date, status, discharge_reason, admitted_by, notes
      )
    `)
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
      billing_periods (*),
      clinical_notes (*)
    `)
    .eq('id', patientId)
    .single()
  return { data: data as DbPatient | null, error }
}

// ─── Admit New Patient ────────────────────────────────────────────────────────

export async function admitNewPatient(
  patientData: Omit<DbPatient, 'id' | 'created_at' | 'admissions' | 'capacity_assessments' | 'billing_periods' | 'clinical_notes'>,
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

export async function updateSubCategory(admissionId: string, newSubCategory: string) {
  const { data, error } = await supabase
    .from('admissions')
    .update({ sub_category: newSubCategory })
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

// ─── Billing Periods ─────────────────────────────────────────────────────────

export async function addBillingPeriod(data: Omit<DbBillingPeriod, 'id' | 'created_at'>) {
  const { data: result, error } = await supabase
    .from('billing_periods')
    .insert([data])
    .select()
    .single()
  return { data: result as DbBillingPeriod | null, error }
}

export async function markBillingPaid(billingId: string) {
  const { data, error } = await supabase
    .from('billing_periods')
    .update({ status: 'Paid' })
    .eq('id', billingId)
    .select()
    .single()
  return { data: data as DbBillingPeriod | null, error }
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

export async function fetchAllPatientCodes(): Promise<string[]> {
  const { data } = await supabase
    .from('patients')
    .select('patient_code')
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

// ─── Undo Discharge (re-activate admission) ──────────────────────────────────

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
