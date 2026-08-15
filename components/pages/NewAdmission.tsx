'use client'
import { useState } from 'react'
import { ChevronRight, CheckCircle2, AlertTriangle, User, ClipboardList, Brain, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DOCTORS, type Patient } from '@/lib/data'

const STEPS = ['Personal Info', 'Admission Type', 'Assessment', 'Review & Submit']

function StepIndicator({ current, total }: { current: number; total: number }) {
  const pct = ((current + 1) / total) * 100
  const r = 20
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - (current + 1) / total)
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-12 h-12 shrink-0">
        <svg width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r={r} fill="none" stroke="#E5E5EA" strokeWidth="4" />
          <circle cx="24" cy="24" r={r} fill="none" stroke="#007AFF" strokeWidth="4"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            transform="rotate(-90 24 24)" className="transition-all duration-500" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[12px] font-bold text-[#007AFF]">{current + 1}/{total}</span>
        </div>
      </div>
      <div>
        <p className="text-[15px] font-semibold text-[#000000]">{STEPS[current]}</p>
        <p className="text-[12px] text-[#8E8E93]">{Math.round(pct)}% complete</p>
      </div>
    </div>
  )
}

function Field({ label, required, children, error }: { label: string; required?: boolean; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">
        {label} {required && <span className="text-[#FF3B30]">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[12px] text-[#FF3B30]">{error}</p>}
    </div>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]/40 placeholder-[#C7C7CC]" />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]/40 text-[#3A3A3C]">
      {children}
    </select>
  )
}

interface PersonalInfo {
  fullName: string; dob: string; gender: string; diagnosis: string;
  address: string; doctor: string; admissionDate: string
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
    diagnosis: '',
    address: prefill?.address ?? '',
    doctor: prefill?.doctor ?? DOCTORS[0],
    admissionDate: new Date().toISOString().split('T')[0],
  })
  const [admissionType, setAdmissionType] = useState<'Independent' | 'High Support' | 'Minor'>('Independent')
  const [assessment, setAssessment] = useState({ date: new Date().toISOString().split('T')[0], assessedBy: DOCTORS[0], result: 'Pass', notes: '' })
  const [errors, setErrors] = useState<Partial<PersonalInfo>>({})

  function calcAge(dob: string, asOf?: string): string {
    if (!dob) return ''
    const d = new Date(dob)
    const ref = asOf ? new Date(asOf) : new Date()
    let years = ref.getFullYear() - d.getFullYear()
    let months = ref.getMonth() - d.getMonth()
    let days = ref.getDate() - d.getDate()
    if (days < 0) {
      months--
      days += new Date(ref.getFullYear(), ref.getMonth(), 0).getDate()
    }
    if (months < 0) { years--; months += 12 }
    const parts = []
    if (years > 0) parts.push(`${years}y`)
    if (months > 0) parts.push(`${months}m`)
    if (days > 0 || parts.length === 0) parts.push(`${days}d`)
    return parts.join(' ')
  }

  function calcAgeYearsOnly(dob: string, asOf?: string): number {
    if (!dob) return 0
    const d = new Date(dob)
    const ref = asOf ? new Date(asOf) : new Date()
    let age = ref.getFullYear() - d.getFullYear()
    if (ref.getMonth() < d.getMonth() || (ref.getMonth() === d.getMonth() && ref.getDate() < d.getDate())) age--
    return age
  }

  function validateStep1(): boolean {
    const e: Partial<PersonalInfo> = {}
    if (!personal.fullName.trim()) e.fullName = 'Required'
    if (!personal.dob) e.dob = 'Required'
    if (!personal.gender) e.gender = 'Required'
    if (!personal.doctor) e.doctor = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const age = personal.dob ? calcAgeYearsOnly(personal.dob, personal.admissionDate) : null
  const isMinorByAge = age !== null && age < 18
  const isAdultByAge = age !== null && age >= 18


  function nextStep() {
    if (step === 0 && !validateStep1()) return
    if (step === 0 && isMinorByAge) setAdmissionType('Minor')
    if (step === 0 && isAdultByAge && admissionType === 'Minor') setAdmissionType('Independent')
    if (step === 1) {
      setAssessment(s => ({
        ...s,
        date: personal.admissionDate,
        result: admissionType === 'High Support' ? 'Fail' : 'Pass',
      }))
    }
    setStep(s => Math.min(s + 1, 3))
  }

  function prevStep() { setStep(s => Math.max(s - 1, 0)) }

  function handleSubmit() {
    const age = calcAgeYearsOnly(personal.dob, personal.admissionDate) || 0
    onSubmit({
      name: personal.fullName,
      age,
      gender: personal.gender,
      dob: personal.dob,
      phone: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      address: personal.address,
      treatingDoctor: personal.doctor,
      admittedBy: '',
      admissionType,
      admissionDate: personal.admissionDate,
      currentSubStatus: admissionType === 'High Support' ? 'HS ≤30 days' : admissionType === 'Independent' ? 'Independent' : 'Minor',
      daysAdmitted: 0,
      nextActionDue: '',
      nextActionType: 'Capacity Assessment',
      status: 'On Track',
      // Pass assessment as a flat field so page.tsx can save it to Supabase
      _admissionAssessment: admissionType !== 'Minor' ? {
        date: assessment.date,
        assessedBy: assessment.assessedBy,
        result: assessment.result as 'Pass' | 'Fail',
        notes: assessment.notes,
      } : undefined,
      admissionHistory: [],
      notes: [],
    } as any)
  }

  const typeCards = [
    { type: 'Independent' as const, color: 'ring-2 ring-[#007AFF] bg-[#007AFF]/5', icon: '✓', desc: 'Patient has passed capacity assessment', badge: 'bg-[#007AFF]' },
    { type: 'High Support' as const, color: 'ring-2 ring-[#FF9500] bg-[#FF9500]/5', icon: '!', desc: 'Patient requires involuntary admission', badge: 'bg-[#FF9500]' },
    { type: 'Minor' as const, color: 'ring-2 ring-[#AF52DE] bg-[#AF52DE]/5', icon: 'M', desc: 'Patient is under 18 years of age', badge: 'bg-[#AF52DE]' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <div className="mb-4">
        <h1 className="text-[20px] font-black text-[#000000] tracking-tight">New Admission</h1>
        <p className="text-[12px] text-[#8E8E93] mt-0.5">Complete all steps to admit a patient</p>
      </div>
      <div className="rounded-2xl border border-[rgba(60,60,67,0.12)] bg-white overflow-hidden">
        {/* Step Indicator */}
        <div className="px-6 py-5 bg-[#F9F9F9] border-b border-[rgba(60,60,67,0.08)] overflow-x-auto">
          <StepIndicator current={step} total={STEPS.length} />
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Step 1 */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-[14px] font-semibold text-[#000000] flex items-center gap-2"><User className="w-4 h-4 text-[#007AFF]" />Personal Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Full Name" required error={errors.fullName}>
                    <Input value={personal.fullName} onChange={e => setPersonal(s => ({ ...s, fullName: e.target.value }))} placeholder="e.g. Rahul Sharma" />
                  </Field>
                </div>
                <Field label="Date of Birth (DD/MM/YYYY)" required error={errors.dob}>
                  <Input type="date" value={personal.dob} onChange={e => setPersonal(s => ({ ...s, dob: e.target.value }))} />
                  {personal.dob && <p className="text-[12px] text-[#8E8E93] mt-1">Age: {calcAge(personal.dob, personal.admissionDate)}</p>}
                </Field>
                <Field label="Gender" required error={errors.gender}>
                  <Select value={personal.gender} onChange={e => setPersonal(s => ({ ...s, gender: e.target.value }))}>
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Diagnosis">
                    <textarea value={personal.diagnosis} onChange={e => setPersonal(s => ({ ...s, diagnosis: e.target.value }))} rows={2}
                      placeholder="Primary diagnosis"
                      className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]/40 resize-none placeholder-[#C7C7CC]" />
                  </Field>
                </div>
                <Field label="Treating Doctor" required error={errors.doctor}>
                  <Select value={personal.doctor} onChange={e => setPersonal(s => ({ ...s, doctor: e.target.value }))}>
                    {DOCTORS.map(d => <option key={d}>{d}</option>)}
                  </Select>
                </Field>
                <Field label="Admission Date" required>
                  <Input type="date" value={personal.admissionDate} onChange={e => setPersonal(s => ({ ...s, admissionDate: e.target.value }))} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Address">
                    <textarea value={personal.address} onChange={e => setPersonal(s => ({ ...s, address: e.target.value }))} rows={2}
                      placeholder="Full address"
                      className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]/40 resize-none placeholder-[#C7C7CC]" />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-[14px] font-semibold text-[#000000] flex items-center gap-2"><ClipboardList className="w-4 h-4 text-[#007AFF]" />Select Admission Type</h2>
              {isMinorByAge && (
                <div className="flex items-start gap-2.5 p-3 bg-[#AF52DE]/10 rounded-2xl">
                  <AlertTriangle className="w-4 h-4 text-[#AF52DE] shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[#AF52DE]">Patient is under 18. Only Minor admission is permitted.</p>
                </div>
              )}
              {isAdultByAge && (
                <div className="flex items-start gap-2.5 p-3 bg-[#FF9500]/10 rounded-2xl">
                  <AlertTriangle className="w-4 h-4 text-[#FF9500] shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[#FF9500]">Patient is 18 or older. Minor admission is not permitted.</p>
                </div>
              )}
              <div className="grid gap-3">
                {typeCards.map(card => {
                  const blocked = (isMinorByAge && card.type !== 'Minor') || (isAdultByAge && card.type === 'Minor')
                  return (
                  <button
                    key={card.type}
                    onClick={() => !blocked && setAdmissionType(card.type)}
                    disabled={blocked}
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-2xl text-left transition-all',
                      blocked ? 'opacity-30 cursor-not-allowed bg-[#F2F2F7]' :
                      admissionType === card.type ? card.color : 'bg-[#F2F2F7] hover:bg-[#E5E5EA]'
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0', card.badge)}>
                      {card.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-[#000000] text-[14px]">{card.type}</p>
                      <p className="text-[12px] text-[#8E8E93] mt-0.5">{card.desc}</p>
                    </div>
                    <div className="ml-auto shrink-0">
                      <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center',
                        admissionType === card.type ? 'border-[#007AFF]' : 'border-[#C7C7CC]'
                      )}>
                        {admissionType === card.type && <div className="w-2.5 h-2.5 rounded-full bg-[#007AFF]" />}
                      </div>
                    </div>
                  </button>
                )})
              }
              </div>
              {admissionType !== 'Minor' && (
                <div className="flex items-start gap-2.5 p-4 bg-[#007AFF]/8 rounded-2xl">
                  <AlertTriangle className="w-4 h-4 text-[#007AFF] shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[#007AFF]">A capacity assessment must be recorded in Step 3.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Assessment */}
          {step === 2 && admissionType !== 'Minor' && (
            <div className="space-y-4">
              <h2 className="text-[14px] font-semibold text-[#000000] flex items-center gap-2"><Brain className="w-4 h-4 text-[#007AFF]" />Capacity Assessment</h2>
              <div className="flex items-start gap-2.5 p-4 rounded-2xl" style={{ background: admissionType === 'High Support' ? 'rgba(255,59,48,0.08)' : 'rgba(52,199,89,0.08)' }}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: admissionType === 'High Support' ? '#FF3B30' : '#34C759' }} />
                <p className="text-[12px]" style={{ color: admissionType === 'High Support' ? '#FF3B30' : '#34C759' }}>
                  {admissionType === 'High Support'
                    ? 'High Support admission requires a failed capacity assessment (patient lacks capacity).'
                    : 'Independent admission requires a passed capacity assessment (patient has capacity).'}
                </p>
              </div>
              <div className="grid gap-4">
                <Field label="Assessment Date" required>
                  <Input type="date" value={assessment.date} onChange={e => setAssessment(s => ({ ...s, date: e.target.value }))} />
                </Field>
                <Field label="Assessed By" required>
                  <Select value={assessment.assessedBy} onChange={e => setAssessment(s => ({ ...s, assessedBy: e.target.value }))}>
                    {DOCTORS.map(d => <option key={d}>{d}</option>)}
                  </Select>
                </Field>
                <Field label="Result">
                  <div className={cn(
                    'w-full rounded-xl px-4 py-3 text-[14px] font-medium',
                    admissionType === 'High Support' ? 'bg-[#FF3B30]/10 text-[#FF3B30]' : 'bg-[#34C759]/10 text-[#34C759]'
                  )}>
                    {admissionType === 'High Support' ? 'Fail — Patient lacks capacity' : 'Pass — Patient has capacity'}
                  </div>
                </Field>
                <Field label="Notes">
                  <textarea value={assessment.notes} onChange={e => setAssessment(s => ({ ...s, notes: e.target.value }))} rows={3}
                    className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]/40 resize-none" />
                </Field>
              </div>
            </div>
          )}

          {/* Step 3: Minor */}
          {step === 2 && admissionType === 'Minor' && (() => {
            const eighteenth = personal.dob ? (() => {
              const d = new Date(personal.dob)
              d.setFullYear(d.getFullYear() + 18)
              return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            })() : null
            return (
              <div className="flex flex-col items-center py-8 text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-[#AF52DE]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-[#AF52DE]" />
                </div>
                <p className="text-[15px] font-medium text-[#000000]">No assessment required</p>
                <p className="text-[13px] text-[#8E8E93]">Minor admission is based on age criteria only.</p>
                {eighteenth && (
                  <div className="mt-1 flex items-start gap-2.5 p-3 bg-[#AF52DE]/10 rounded-2xl text-left w-full">
                    <AlertTriangle className="w-4 h-4 text-[#AF52DE] shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#AF52DE]">
                      A capacity assessment will be scheduled on their 18th birthday — <strong>{eighteenth}</strong>.
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Step 4: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-[15px] font-semibold text-[#000000] flex items-center gap-2"><Eye className="w-4 h-4 text-[#007AFF]" />Review & Submit</h2>
              <div className="bg-[#F2F2F7] rounded-2xl p-5 space-y-3 text-[13px]">
                <div className="flex items-center justify-between pb-2 ios-separator">
                  <span className="font-semibold text-[#000000]">Personal Information</span>
                  <button onClick={() => setStep(0)} className="text-[#007AFF] text-[13px] active:opacity-60">Edit</button>
                </div>
                {[
                  ['Name', personal.fullName],
                  ['DOB', personal.dob],
                  ['Age', calcAge(personal.dob, personal.admissionDate)],
                  ['Gender', personal.gender],
                  ['Diagnosis', personal.diagnosis || '—'],
                  ['Doctor', personal.doctor],
                  ['Admission Date', personal.admissionDate],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-0.5">
                    <span className="text-[#8E8E93]">{label}</span>
                    <span className="text-[#000000] font-medium">{value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 ios-separator">
                  <span className="font-semibold text-[#000000]">Admission Type</span>
                  <button onClick={() => setStep(1)} className="text-[#007AFF] text-[13px] active:opacity-60">Edit</button>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-[#8E8E93]">Type</span>
                  <span className="text-[#000000] font-medium">{admissionType}</span>
                </div>
                {admissionType !== 'Minor' && (
                  <>
                    <div className="flex items-center justify-between pt-3 ios-separator">
                      <span className="font-semibold text-[#000000]">Assessment</span>
                      <button onClick={() => setStep(2)} className="text-[#007AFF] text-[13px] active:opacity-60">Edit</button>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-[#8E8E93]">Result</span>
                      <span className={cn('font-semibold', assessment.result === 'Pass' ? 'text-[#34C759]' : 'text-[#FF3B30]')}>
                        {assessment.result}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="px-6 py-4 border-t border-[rgba(60,60,67,0.08)] bg-[#F9F9F9] flex justify-between">
          <button
            onClick={prevStep}
            disabled={step === 0}
            className="px-5 py-2.5 text-[14px] bg-[#E5E5EA] rounded-xl text-[#3A3A3C] font-medium active:bg-[#D1D1D6] disabled:opacity-30 transition-colors"
          >
            Back
          </button>
          {step < 3 ? (
            <button onClick={nextStep} className="flex items-center gap-1.5 px-5 py-2.5 text-[14px] bg-[#007AFF] text-white rounded-xl font-medium active:opacity-80 transition-opacity">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} className="flex items-center gap-2 px-5 py-2.5 text-[14px] bg-[#007AFF] text-white rounded-xl font-medium active:opacity-80 transition-opacity">
              <CheckCircle2 className="w-4 h-4" />
              Confirm & Admit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
