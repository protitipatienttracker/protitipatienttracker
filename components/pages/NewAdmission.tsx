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
  fullName: string; dob: string; gender: string; phone: string;
  emergencyContact: string; emergencyPhone: string; address: string; doctor: string;
  admissionDate: string
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
    admissionDate: new Date().toISOString().split('T')[0],
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
    if (!personal.fullName.trim()) e.fullName = 'Required'
    if (!personal.dob) e.dob = 'Required'
    if (!personal.gender) e.gender = 'Required'
    if (!personal.emergencyContact.trim()) e.emergencyContact = 'Required'
    if (!personal.emergencyPhone.trim()) e.emergencyPhone = 'Required'
    if (!personal.doctor) e.doctor = 'Required'
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
      admissionDate: personal.admissionDate,
      currentSubStatus: admissionType === 'High Support' ? 'HS ≤30 days' : admissionType === 'Independent' ? 'Independent' : 'Minor',
      daysAdmitted: 0,
      nextActionDue: '',
      nextActionType: 'Capacity Assessment',
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
    { type: 'Independent' as const, color: 'ring-2 ring-[#007AFF] bg-[#007AFF]/5', icon: '✓', desc: 'Patient has passed capacity assessment', badge: 'bg-[#007AFF]' },
    { type: 'High Support' as const, color: 'ring-2 ring-[#FF9500] bg-[#FF9500]/5', icon: '!', desc: 'Patient requires involuntary admission', badge: 'bg-[#FF9500]' },
    { type: 'Minor' as const, color: 'ring-2 ring-[#AF52DE] bg-[#AF52DE]/5', icon: 'M', desc: 'Patient is under 18 years of age', badge: 'bg-[#AF52DE]' },
  ]

  return (
    <div className="p-5 sm:p-6 max-w-2xl">
      <div className="ios-card overflow-hidden">
        {/* Step Indicator */}
        <div className="px-6 py-5 bg-[#F2F2F7]/60 ios-separator overflow-x-auto">
          <StepIndicator current={step} total={STEPS.length} />
        </div>

        <div className="p-6 space-y-5">
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
                <Field label="Date of Birth" required error={errors.dob}>
                  <Input type="date" value={personal.dob} onChange={e => setPersonal(s => ({ ...s, dob: e.target.value }))} />
                  {personal.dob && <p className="text-[12px] text-[#8E8E93] mt-1">Age: {calcAge(personal.dob)} years</p>}
                </Field>
                <Field label="Gender" required error={errors.gender}>
                  <Select value={personal.gender} onChange={e => setPersonal(s => ({ ...s, gender: e.target.value }))}>
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </Select>
                </Field>
                <Field label="Phone">
                  <Input value={personal.phone} onChange={e => setPersonal(s => ({ ...s, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" />
                </Field>
                <Field label="Emergency Contact" required error={errors.emergencyContact}>
                  <Input value={personal.emergencyContact} onChange={e => setPersonal(s => ({ ...s, emergencyContact: e.target.value }))} placeholder="Contact name" />
                </Field>
                <Field label="Emergency Phone" required error={errors.emergencyPhone}>
                  <Input value={personal.emergencyPhone} onChange={e => setPersonal(s => ({ ...s, emergencyPhone: e.target.value }))} placeholder="+91 XXXXX XXXXX" />
                </Field>
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
              <div className="grid gap-3">
                {typeCards.map(card => (
                  <button
                    key={card.type}
                    onClick={() => setAdmissionType(card.type)}
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-2xl text-left transition-all',
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
                ))}
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
              {assessmentMismatch && (
                <div className="flex items-start gap-2.5 p-4 bg-[#FF9500]/10 rounded-2xl">
                  <AlertTriangle className="w-4 h-4 text-[#FF9500] shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[#FF9500]">
                    Result ({assessment.result}) doesn't match admission type ({admissionType}). Please verify.
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
                    <option value="Pass">Pass — Patient has capacity</option>
                    <option value="Fail">Fail — Patient lacks capacity</option>
                  </Select>
                </Field>
                <Field label="Notes">
                  <textarea value={assessment.notes} onChange={e => setAssessment(s => ({ ...s, notes: e.target.value }))} rows={3}
                    className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]/40 resize-none" />
                </Field>
              </div>
            </div>
          )}

          {/* Step 3: Minor */}
          {step === 2 && admissionType === 'Minor' && (
            <div className="flex flex-col items-center py-8 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-[#AF52DE]/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-[#AF52DE]" />
              </div>
              <p className="text-[15px] font-medium text-[#000000]">No assessment required</p>
              <p className="text-[13px] text-[#8E8E93]">Minor admission is based on age criteria only.</p>
            </div>
          )}

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
                  ['Age', calcAge(personal.dob)],
                  ['Gender', personal.gender],
                  ['Phone', personal.phone || '—'],
                  ['Emergency Contact', personal.emergencyContact],
                  ['Doctor', personal.doctor],
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
        <div className="px-6 py-4 ios-separator bg-[#F2F2F7]/40 flex justify-between">
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
