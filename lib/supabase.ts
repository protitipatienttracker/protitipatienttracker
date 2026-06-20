import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Raw Supabase Row Types ────────────────────────────────────────────────────

export interface DbPatient {
  id: string
  patient_code: string
  full_name: string
  date_of_birth: string
  gender: string
  phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  address: string | null
  treating_doctor: string | null
  created_at: string
  admissions?: DbAdmission[]
  capacity_assessments?: DbAssessment[]
  billing_periods?: DbBillingPeriod[]
  clinical_notes?: DbNote[]
}

export interface DbAdmission {
  id: string
  patient_id: string
  admission_type: 'Independent' | 'High Support' | 'Minor'
  sub_category: string | null
  admission_date: string
  discharge_date: string | null
  discharge_reason: string | null
  status: 'Active' | 'Discharged'
  admitted_by: string | null
  notes: string | null
  created_at: string
  patients?: Pick<DbPatient, 'full_name' | 'patient_code'>
}

export interface DbAssessment {
  id: string
  patient_id: string
  admission_id: string
  assessment_date: string
  assessed_by: string
  result: 'Pass' | 'Fail'
  notes: string | null
  next_assessment_due: string | null
  created_at: string
  patients?: Pick<DbPatient, 'full_name' | 'patient_code'>
}

export interface DbBillingPeriod {
  id: string
  patient_id: string
  admission_id: string
  period_label: string | null
  from_date: string
  to_date: string
  sub_category: string | null
  amount: number | null
  status: 'Paid' | 'Pending'
  created_at: string
}

export interface DbTransfer {
  id: string
  patient_id: string
  from_admission_id: string | null
  to_admission_id: string | null
  transfer_date: string
  from_type: string | null
  to_type: string | null
  reason: string | null
  triggered_by: string | null
  notes: string | null
  created_at: string
  patients?: Pick<DbPatient, 'full_name' | 'patient_code'>
}

export interface DbNote {
  id: string
  patient_id: string
  admission_id: string
  note_date: string
  author: string | null
  note_type: 'Clinical' | 'Administrative' | 'Legal' | null
  content: string
  created_at: string
}

export interface DbNotification {
  id: string
  patient_id: string | null
  type: string | null
  message: string
  due_date: string | null
  is_read: boolean
  created_at: string
  patients?: Pick<DbPatient, 'full_name' | 'patient_code'> | null
}

// ─── Staff & Settings Types ────────────────────────────────────────────────────

export interface DbStaff {
  id: string
  name: string
  role: string
  email: string
  status: 'Active' | 'Inactive'
  created_at: string
}

export interface DbSettings {
  id: string
  key: string
  value: string
  created_at: string
}
