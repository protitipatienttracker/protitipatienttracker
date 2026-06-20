'use client'
import { useState } from 'react'
import { ChevronRight, CheckCircle2, AlertTriangle, User, ClipboardList, Brain, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DOCTORS, type Patient } from '@/lib/data'

const STEPS = ['Personal Info', 'Admission Type', 'Assessment', 'Review & Submit']

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all',
            i < current ? 'bg-green-100 text-green-700' :
            i === current ? 'bg-[#0D6E6E] text-white' :
            'bg-slate-100 text-slate-400'
          )}>
            {i < current ? <CheckCircle2 className="w-3.5 h-3.5" /> :
              <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-[11px] font-bold border-current">
                {i + 1}
              </span>
            }
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i < total - 1 && <div className={cn('w-6 h-px mx-1', i < current ? 'bg-green-300' : 'bg-slate-200')} />}
        </div>
      ))}
    </div>
  )
}

function Field({ label, required, children, error }: { label: string; required?: boolean; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30 bg-white" />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30 bg-white text-slate-700">
      {children}
    </select>
  )
}

interface PersonalInfo {
  fullName: string; dob: string; gender: string; phone: string;
  emergencyContact: string; emergencyPhone: string; address: string; doctor: string
}

interface Props {
  onSubmit: (patient: Partial<Patient>) => void
  prefill?: Partial<PersonalInfo>
}

export default function NewAdmission({ onSubmit, prefill }: Props) {
  const [step, setStep] = useState(0)
  const [personal, setPersonal] = useState<PersonalInfo>({
    fullName: prefill?.fullName ?? '',
    dob: prefill?.dob ?? '',
    gender: prefill?.gender ?? '',
    phone: prefill?.phone ?? '',
    emergencyContact: prefill?.emergencyContact ?? '',
    emergencyPhone: prefill?.emergencyPhone ?? '',
    address: prefill?.address ?? '',
    doctor: prefill?.doctor ?? DOCTORS[0],
  })
  const [admissionType, setAdmissionType] = useState<'Independent' | 'High Support' | 'Minor'>('Independent')
  const [assessment, setAssessment] = useState({ date: new Date().toISOString().split('T')[0], assessedBy: DOCTORS[0], result: 'Pass', notes: '' })
  const [errors, setErrors] = useState<Partial<PersonalInfo>>({})

  function calcAge(dob: string) {
    if (!dob) return ''
    const d = new Date(dob)
    const now = new Date()
    return Math.floor((now.getTime() - d.getTime()) / (365.25 * 86400000)).toString()
  }

  function validateStep1(): boolean {
    const e: Partial<PersonalInfo> = {}
    if (!personal.fullName.trim()) e.fullName = 'Full name is required'
    if (!personal.dob) e.dob = 'Date of birth is required'
    if (!personal.gender) e.gender = 'Gender is required'
    if (!personal.emergencyContact.trim()) e.emergencyContact = 'Emergency contact name is required'
    if (!personal.emergencyPhone.trim()) e.emergencyPhone = 'Emergency contact phone is required'
    if (!personal.doctor) e.doctor = 'Treating doctor is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function nextStep() {
    if (step === 0 && !validateStep1()) return
    setStep(s => Math.min(s + 1, 3))
  }

  function prevStep() { setStep(s => Math.max(s - 1, 0)) }

  const assessmentMismatch =
    (admissionType === 'Independent' && assessment.result === 'Fail') ||
    (admissionType === 'High Support' && assessment.result === 'Pass')

  function handleSubmit() {
    const age = Number(calcAge(personal.dob)) || 0
    onSubmit({
      name: personal.fullName,
      age,
      gender: personal.gender,
      dob: personal.dob,
      phone: personal.phone,
      emergencyContactName: personal.emergencyContact,
      emergencyContactPhone: personal.emergencyPhone,
      address: personal.address,
      treatingDoctor: personal.doctor,
      admittedBy: 'Arjun Sathe',
      admissionType,
      admissionDate: new Date().toISOString().split('T')[0],
      currentSubStatus: admissionType === 'High Support' ? 'HS ≤30 days' : admissionType === 'Independent' ? 'Independent' : 'Minor',
      daysAdmitted: 0,
      nextActionDue: '',
      nextActionType: admissionType === 'High Support' ? 'Capacity Assessment' : 'Capacity Assessment',
      status: 'On Track',
      assessments: admissionType !== 'Minor' ? [{
        id: `A-${Date.now()}`,
        date: assessment.date,
        conductedBy: assessment.assessedBy,
        result: assessment.result as 'Pass' | 'Fail',
        notes: assessment.notes,
        nextDue: '',
      }] : [],
      admissionHistory: [],
      notes: [],
      billingPeriods: [],
    })
  }

  const typeCards = [
    { type: 'Independent' as const, color: 'border-teal-500 bg-teal-50', icon: '✓', desc: 'Patient has passed capacity assessment and is voluntarily admitted', badge: 'bg-teal-500' },
    { type: 'High Support' as const, color: 'border-amber-500 bg-amber-50', icon: '!', desc: 'Patient has failed capacity assessment and requires involuntary admission', badge: 'bg-amber-500' },
    { type: 'Minor' as const, color: 'border-purple-500 bg-purple-50', icon: 'M', desc: 'Patient is under 18 years of age', badge: 'bg-purple-500' },
  ]

  return (
    <div className="p-6 max-w-2xl">
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
        {/* Step Indicator */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 overflow-x-auto">
          <StepIndicator current={step} total={STEPS.length} />
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1: Personal Info */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><User className="w-4 h-4 text-[#0D6E6E]" />Personal Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Full Name" required error={errors.fullName}>
                    <Input value={personal.fullName} onChange={e => setPersonal(s => ({ ...s, fullName: e.target.value }))} placeholder="e.g. Rahul Sharma" />
                  </Field>
                </div>
                <Field label="Date of Birth" required error={errors.dob}>
                  <Input type="date" value={personal.dob} onChange={e => setPersonal(s => ({ ...s, dob: e.target.value }))} />
                  {personal.dob && <p className="text-xs text-slate-500 mt-1">Age: {calcAge(personal.dob)} years</p>}
                </Field>
                <Field label="Gender" required error={errors.gender}>
                  <Select value={personal.gender} onChange={e => setPersonal(s => ({ ...s, gender: e.target.value }))}>
                    <option value="">Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                    <option>Prefer not to say</option>
                  </Select>
                </Field>
                <Field label="Phone Number">
                  <Input value={personal.phone} onChange={e => setPersonal(s => ({ ...s, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" />
                </Field>
                <Field label="Emergency Contact Name" required error={errors.emergencyContact}>
                  <Input value={personal.emergencyContact} onChange={e => setPersonal(s => ({ ...s, emergencyContact: e.target.value }))} placeholder="Contact name" />
                </Field>
                <Field label="Emergency Contact Phone" required error={errors.emergencyPhone}>
                  <Input value={personal.emergencyPhone} onChange={e => setPersonal(s => ({ ...s, emergencyPhone: e.target.value }))} placeholder="+91 XXXXX XXXXX" />
                </Field>
                <Field label="Treating Doctor" required error={errors.doctor}>
                  <Select value={personal.doctor} onChange={e => setPersonal(s => ({ ...s, doctor: e.target.value }))}>
                    {DOCTORS.map(d => <option key={d}>{d}</option>)}
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Address">
                    <textarea value={personal.address} onChange={e => setPersonal(s => ({ ...s, address: e.target.value }))} rows={2}
                      placeholder="Full address"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30 resize-none" />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Admission Type */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-[#0D6E6E]" />Select Admission Type</h2>
              <div className="grid gap-3">
                {typeCards.map(card => (
                  <button
                    key={card.type}
                    onClick={() => setAdmissionType(card.type)}
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all',
                      admissionType === card.type ? card.color : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0', card.badge)}>
                      {card.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{card.type} Admission</p>
                      <p className="text-xs text-slate-500 mt-0.5">{card.desc}</p>
                    </div>
                    <div className="ml-auto shrink-0">
                      <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center',
                        admissionType === card.type ? 'border-current' : 'border-slate-300'
                      )}>
                        {admissionType === card.type && <div className="w-2 h-2 rounded-full bg-current" />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {admissionType !== 'Minor' && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">A capacity assessment result must be recorded in Step 3.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Assessment (skipped for Minor) */}
          {step === 2 && admissionType !== 'Minor' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Brain className="w-4 h-4 text-[#0D6E6E]" />Capacity Assessment</h2>
              {assessmentMismatch && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    The assessment result ({assessment.result}) does not match the selected admission type ({admissionType}).
                    Please verify before proceeding.
                  </p>
                </div>
              )}
              <div className="grid gap-4">
                <Field label="Assessment Date" required>
                  <Input type="date" value={assessment.date} onChange={e => setAssessment(s => ({ ...s, date: e.target.value }))} />
                </Field>
                <Field label="Assessed By" required>
                  <Select value={assessment.assessedBy} onChange={e => setAssessment(s => ({ ...s, assessedBy: e.target.value }))}>
                    {DOCTORS.map(d => <option key={d}>{d}</option>)}
                  </Select>
                </Field>
                <Field label="Result" required>
                  <Select value={assessment.result} onChange={e => setAssessment(s => ({ ...s, result: e.target.value }))}>
                    <option value="Pass">Pass — Patient has capacity (Independent)</option>
                    <option value="Fail">Fail — Patient lacks capacity (High Support)</option>
                  </Select>
                </Field>
                <Field label="Notes">
                  <textarea value={assessment.notes} onChange={e => setAssessment(s => ({ ...s, notes: e.target.value }))} rows={3}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30 resize-none" />
                </Field>
              </div>
            </div>
          )}

          {/* Step 3: Minor shortcut */}
          {step === 2 && admissionType === 'Minor' && (
            <div className="flex flex-col items-center py-8 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-purple-600" />
              </div>
              <p className="text-sm font-medium text-slate-700">No assessment required</p>
              <p className="text-xs text-slate-500">Minor admission is based on age criteria only. You can proceed to review.</p>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-700 flex items-center gap-2"><Eye className="w-4 h-4 text-[#0D6E6E]" />Review & Submit</h2>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="font-semibold text-slate-800">Personal Information</span>
                  <button onClick={() => setStep(0)} className="text-[#0D6E6E] hover:underline text-xs">Edit</button>
                </div>
                {[
                  ['Name', personal.fullName],
                  ['DOB', personal.dob],
                  ['Age', calcAge(personal.dob)],
                  ['Gender', personal.gender],
                  ['Phone', personal.phone || '—'],
                  ['Emergency Contact', personal.emergencyContact],
                  ['Emergency Phone', personal.emergencyPhone],
                  ['Treating Doctor', personal.doctor],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-500">{label}</span>
                    <span className="text-slate-800 font-medium">{value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-800">Admission Type</span>
                  <button onClick={() => setStep(1)} className="text-[#0D6E6E] hover:underline text-xs">Edit</button>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="text-slate-800 font-medium">{admissionType}</span>
                </div>
                {admissionType !== 'Minor' && (
                  <>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="font-semibold text-slate-800">Assessment</span>
                      <button onClick={() => setStep(2)} className="text-[#0D6E6E] hover:underline text-xs">Edit</button>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Result</span>
                      <span className={cn('font-semibold', assessment.result === 'Pass' ? 'text-green-600' : 'text-red-600')}>
                        {assessment.result}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between">
          <button
            onClick={prevStep}
            disabled={step === 0}
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-white disabled:opacity-40 transition-colors"
          >
            Back
          </button>
          {step < 3 ? (
            <button onClick={nextStep} className="flex items-center gap-1.5 px-5 py-2 text-sm bg-[#0D6E6E] text-white rounded-lg hover:bg-[#0A5858] transition-colors">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} className="flex items-center gap-2 px-5 py-2 text-sm bg-[#0D6E6E] text-white rounded-lg hover:bg-[#0A5858] font-medium transition-colors">
              <CheckCircle2 className="w-4 h-4" />
              Confirm & Admit Patient
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
