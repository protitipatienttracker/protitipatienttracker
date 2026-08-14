'use client'
import { useState } from 'react'
import { ArrowLeft, LogOut, Plus, CheckCircle2, Brain, Phone, FileText, ArrowLeftRight, Clock } from 'lucide-react'
import { StatusBadge, AdmissionTypeBadge } from '@/components/ui/badge-status'
import { Modal } from '@/components/ui/modal'
import { formatDate, type Patient, type Assessment, type Note } from '@/lib/data'
import { cn } from '@/lib/utils'

function relativeDate(dateStr: string): string {
  const now = new Date()
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}
import {
  addCapacityAssessment, dischargePatient, addClinicalNote,
  updateSubCategory, insertTransfer, insertNotification,
  getNextAssessmentDate, updatePatientField, undoDischarge,
  generateHsShiftNotifications,
} from '@/lib/db'

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['bg-[#007AFF]', 'bg-[#5856D6]', 'bg-[#AF52DE]', 'bg-[#FF9500]', 'bg-[#FF3B30]', 'bg-[#34C759]']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0', color)}>
      {initials}
    </div>
  )
}

const ALL_PERIODS: [number, number][] = [[0,30],[30,90],[90,120],[120,180],[180,361]]

function getPeriodFromDays(days: number): [number, number] {
  for (const [start, end] of ALL_PERIODS) {
    if (days <= end) return [start, end]
  }
  // Beyond 361: recurring 181-day windows
  const base = 180
  const window = 181
  const n = Math.ceil((days - base) / window)
  return [base + (n - 1) * window, base + n * window]
}

function SubCategoryBar({ daysAdmitted }: { daysAdmitted: number }) {
  const [periodStart, periodEnd] = getPeriodFromDays(daysAdmitted)
  const daysInPeriod = periodEnd - periodStart
  const daysIntoPeriod = Math.max(0, daysAdmitted - periodStart)
  const pct = Math.min((daysIntoPeriod / daysInPeriod) * 100, 100)
  const labels = [periodStart, periodEnd]
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[11px] text-[#8E8E93] mb-1">
        {labels.map(m => <span key={m}>{m}d</span>)}
      </div>
      <div className="relative h-3 bg-[#E5E5EA] rounded-full overflow-visible">
        <div className="absolute h-full bg-gradient-to-r from-[#007AFF] to-[#5AC8FA] rounded-full" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#007AFF] rounded-full shadow-sm" style={{ left: `calc(${pct}% - 8px)` }} />
      </div>
      <p className="text-[13px] text-[#8E8E93] mt-2">Day {daysAdmitted} of {periodEnd}</p>
    </div>
  )
}

interface Props {
  patient: Patient
  onBack: () => void
  onNavigate: (page: string) => void
  onAddToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void
  onUpdatePatient: (patient: Patient) => void
  onRefreshPatient?: (patientId: string) => Promise<void>
  onRefreshData?: () => Promise<void>
}

export default function PatientDetail({ patient, onBack, onNavigate, onAddToast, onUpdatePatient, onRefreshPatient, onRefreshData }: Props) {
  const [activeTab, setActiveTab] = useState(0)
  const [assessmentModal, setAssessmentModal] = useState(false)
  const [dischargeModal, setDischargeModal] = useState(false)
  const [dischargeDate, setDischargeDate] = useState(new Date().toISOString().split('T')[0])
  const [dischargeReason, setDischargeReason] = useState('Clinical Decision')
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState<'Clinical' | 'Administrative' | 'Legal'>('Clinical')
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0])
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [shiftModal, setShiftModal] = useState(false)
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().split('T')[0])
  const [shiftTo, setShiftTo] = useState('Independent')
  const [shiftReason, setShiftReason] = useState('')
  const [shiftDone, setShiftDone] = useState(false)

  const [newAssessment, setNewAssessment] = useState({
    date: new Date().toISOString().split('T')[0],
    conductedBy: '',
    result: 'Pass' as 'Pass' | 'Fail',
    notes: '',
  })

  const tabs = ['Overview', 'History', 'Assessments', 'Notes']

  async function handleSaveAssessment() {
    if (!patient.activeAdmissionId) { onAddToast('error', 'No active admission'); return }
    if (!patient.id) { onAddToast('error', 'Patient ID missing'); return }
    const nextDue = getNextAssessmentDate(patient.admissionDate, newAssessment.date, patient.admissionType, patient.currentSubStatus)
    const payload = {
      patient_id: patient.id,
      admission_id: patient.activeAdmissionId,
      assessment_date: newAssessment.date,
      assessed_by: newAssessment.conductedBy,
      result: newAssessment.result,
      notes: newAssessment.notes || null,
      next_assessment_due: nextDue.toISOString().split('T')[0],
    }
    const { error } = await addCapacityAssessment(payload)
    if (error) { onAddToast('error', 'Save failed', error.message); console.error('CA save error:', error, 'payload:', payload); return }
    // Verify it was actually saved
    console.log('CA saved successfully, refreshing patient...')
    if (newAssessment.result === 'Pass' && (patient.admissionType === 'High Support' || patient.currentSubStatus.startsWith('CHS'))) {
      await updateSubCategory(patient.activeAdmissionId, 'Independent')
      await insertTransfer({
        patient_id: patient.id, from_admission_id: patient.activeAdmissionId,
        to_admission_id: patient.activeAdmissionId, transfer_date: newAssessment.date,
        from_type: patient.currentSubStatus, to_type: 'Independent',
        reason: 'Capacity assessment passed', triggered_by: 'System', notes: newAssessment.notes || null,
      })
      onAddToast('success', 'Shifted to Independent')
    } else if (newAssessment.result === 'Fail' && patient.admissionType === 'Independent') {
      // Auto-shift to High Support — patient has lost capacity
      await updateSubCategory(patient.activeAdmissionId, 'HS ≤30 days')
      await insertTransfer({
        patient_id: patient.id, from_admission_id: patient.activeAdmissionId,
        to_admission_id: patient.activeAdmissionId, transfer_date: newAssessment.date,
        from_type: 'Independent', to_type: 'HS ≤30 days',
        reason: 'Capacity lost — failed assessment', triggered_by: 'System', notes: newAssessment.notes || null,
      })
      await generateHsShiftNotifications(patient.id, patient.name, patient.patientCode, newAssessment.date)
      onAddToast('warning', 'Capacity lost', 'Patient shifted to High Support (HS ≤30 days).')
    } else {
      onAddToast('success', 'Assessment recorded')
    }
    setAssessmentModal(false)
    setNewAssessment(s => ({ ...s, notes: '', result: 'Pass' }))
    if (onRefreshPatient) await onRefreshPatient(patient.id)
    if (onRefreshData) await onRefreshData()
  }

  async function handleDischarge() {
    if (!patient.activeAdmissionId) { onAddToast('error', 'No active admission'); return }
    const admissionId = patient.activeAdmissionId
    const { error } = await dischargePatient(admissionId, dischargeReason, dischargeDate)
    if (error) { onAddToast('error', 'Failed', error.message); return }
    await insertNotification({ patient_id: patient.id, type: 'Discharge', message: `${patient.name} discharged.`, due_date: dischargeDate })
    setDischargeModal(false)
    onAddToast('warning', `${patient.name} discharged`, 'Tap Undo within 5 seconds to reverse.', {
      label: 'Undo',
      onClick: async () => {
        await undoDischarge(admissionId)
        if (onRefreshPatient) await onRefreshPatient(patient.id)
        onAddToast('success', 'Discharge undone')
      }
    })
    onBack()
  }

  async function handleInlineEdit(field: string) {
    if (!editValue.trim()) { setEditingField(null); return }
    const { error } = await updatePatientField(patient.id, field, editValue)
    if (error) { onAddToast('error', 'Update failed'); setEditingField(null); return }
    setEditingField(null)
    if (onRefreshPatient) await onRefreshPatient(patient.id)
  }

  const CHS_OPTIONS = ['CHS >30 days', 'CHS >90 days', 'CHS >120 days', 'CHS >180 days']

  async function handleShiftToCHSFromTimeline(onDate: string, fromSub: string, toSub: string) {
    if (!patient.activeAdmissionId) return
    await updateSubCategory(patient.activeAdmissionId, toSub)
    await insertTransfer({
      patient_id: patient.id, from_admission_id: patient.activeAdmissionId,
      to_admission_id: patient.activeAdmissionId, transfer_date: onDate,
      from_type: fromSub, to_type: toSub,
      reason: `Milestone shift — ${fromSub} → ${toSub}`, triggered_by: 'System', notes: null,
    })
    onAddToast('success', `Shifted to ${toSub}`)
    if (onRefreshPatient) await onRefreshPatient(patient.id)
    if (onRefreshData) await onRefreshData()
  }

  async function handleShiftType() {
    if (!patient.activeAdmissionId) { onAddToast('error', 'No active admission'); return }
    const newSub = shiftTo === 'High Support' ? 'HS ≤30 days' : shiftTo
    await updateSubCategory(patient.activeAdmissionId, newSub)
    await insertTransfer({
      patient_id: patient.id, from_admission_id: patient.activeAdmissionId,
      to_admission_id: patient.activeAdmissionId, transfer_date: shiftDate,
      from_type: patient.currentSubStatus, to_type: newSub,
      reason: shiftReason || 'Type shift', triggered_by: 'Staff', notes: null,
    })
    setShiftDone(true)
    if (newSub === 'HS ≤30 days') {
      await generateHsShiftNotifications(patient.id, patient.name, patient.patientCode, shiftDate)
    }
    setTimeout(() => {
      setShiftModal(false)
      setShiftDone(false)
      setShiftReason('')
    }, 1200)
    onAddToast('success', `Shifted to ${newSub}`, `Effective ${shiftDate}`)
    if (onRefreshPatient) await onRefreshPatient(patient.id)
  }

  async function handleAddNote() {
    if (!noteText.trim() || !patient.activeAdmissionId) return
    const { error } = await addClinicalNote({
      patient_id: patient.id, admission_id: patient.activeAdmissionId,
      note_date: noteDate, author: 'Staff', note_type: noteType, content: noteText,
    })
    if (error) { onAddToast('error', 'Failed', error.message); return }
    setNoteText(''); setShowNoteForm(false)
    onAddToast('success', 'Note added')
    if (onRefreshPatient) await onRefreshPatient(patient.id)
  }


  return (
    <div className="p-5 sm:p-6 space-y-4 max-w-5xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[14px] text-[#007AFF] active:opacity-60">
        <ArrowLeft className="w-4 h-4" />
        All Patients
      </button>

      {/* Header */}
      <div className="ios-card overflow-hidden">
        <div className="px-4 sm:px-6 pt-5 pb-4">

          {/* Row 1: Avatar + Name + Discharge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={patient.name} />
              <div>
                <h1 className="text-[18px] font-bold text-[#000000] leading-tight">{patient.name}</h1>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <AdmissionTypeBadge type={patient.currentSubStatus.startsWith('CHS') || patient.currentSubStatus === 'HS ≤30 days' ? patient.currentSubStatus : patient.admissionType} />
                  <StatusBadge status={patient.status} tooltip={patient.statusReason || undefined} />
                </div>
              </div>
            </div>
            {patient.admissionType !== 'Discharged' && (
              <button onClick={() => setDischargeModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#FF3B30]/10 rounded-xl text-[12px] text-[#FF3B30] font-medium active:bg-[#FF3B30]/20 shrink-0 mb-0.5">
                <LogOut className="w-3.5 h-3.5" /> Discharge
              </button>
            )}
          </div>

          {/* Row 2: Meta info strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 px-1">
            <span className="text-[12px] text-[#8E8E93] font-mono">{patient.patientCode}</span>
            <span className="text-[12px] text-[#8E8E93]">Age {patient.age} · {patient.gender}</span>
            <span className="text-[12px] text-[#8E8E93]">Dr. {patient.treatingDoctor.replace('Dr. ', '')}</span>
            {patient.admissionDate && (
              <span className="text-[12px] text-[#8E8E93]">Admitted {formatDate(patient.admissionDate)}</span>
            )}
            {patient.daysAdmitted > 0 && (
              <span className="text-[12px] text-[#8E8E93]">Day {patient.daysAdmitted}</span>
            )}
          </div>

          {/* Row 3: Action buttons */}
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[rgba(60,60,67,0.08)]">
            {patient.phone && (
              <a href={`tel:${patient.phone}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#34C759]/10 text-[#34C759] rounded-xl text-[12px] font-medium">
                <Phone className="w-3.5 h-3.5" /> Call
              </a>
            )}
            <button onClick={() => { setShowNoteForm(true); setActiveTab(3) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#007AFF]/10 text-[#007AFF] rounded-xl text-[12px] font-medium">
              <FileText className="w-3.5 h-3.5" /> Add Note
            </button>
            {patient.admissionType !== 'Discharged' && (
              <button onClick={() => setAssessmentModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#5856D6]/10 text-[#5856D6] rounded-xl text-[12px] font-medium">
                <Brain className="w-3.5 h-3.5" /> Assessment
              </button>
            )}
            {patient.admissionType !== 'Discharged' && patient.admissionType !== 'Minor' && (
              <button onClick={() => setShiftModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#FF9500]/10 text-[#FF9500] rounded-xl text-[12px] font-medium">
                <ArrowLeftRight className="w-3.5 h-3.5" /> Shift Type
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ios-card overflow-hidden">
        <div className="flex ios-separator overflow-x-auto px-2">
          {tabs.map((tab, i) => (
            <button key={i} onClick={() => setActiveTab(i)}
              className={cn('px-5 py-3.5 text-[13px] font-medium whitespace-nowrap transition-colors border-b-2',
                activeTab === i ? 'border-[#007AFF] text-[#007AFF]' : 'border-transparent text-[#8E8E93]'
              )}>
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {/* Overview */}
          {activeTab === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">Personal</h3>
                <div className="bg-[#F2F2F7] rounded-2xl overflow-hidden">
                  {[
                    ['Date of Birth', patient.dob, false],
                    ['Phone', patient.phone, true],
                    ['Emergency', patient.emergencyContactName, true],
                    ['Emergency Ph.', patient.emergencyContactPhone, true],
                    ['Address', patient.address, true],
                    ['Admitted By', patient.admittedBy, false],
                    ['Doctor', patient.treatingDoctor, true],
                  ].map(([label, value, editable], i, arr) => (
                    <div key={label as string} className={cn('flex items-center justify-between px-4 py-3 min-h-[44px]', i < arr.length - 1 && 'ios-separator')}>
                      <span className="text-[13px] text-[#8E8E93]">{label as string}</span>
                      {editingField === label ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => handleInlineEdit(label as string)}
                          onKeyDown={e => e.key === 'Enter' && handleInlineEdit(label as string)}
                          className="text-[13px] text-right bg-white rounded-lg px-2 py-1 w-[55%] outline-none ring-2 ring-[#007AFF]/30"
                        />
                      ) : (
                        <span
                          className={cn('text-[13px] text-[#000000] font-medium text-right max-w-[55%] truncate', editable && 'cursor-pointer hover:text-[#007AFF]')}
                          onClick={() => { if (editable) { setEditingField(label as string); setEditValue(value as string) } }}
                        >
                          {value as string || '—'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">Current Admission</h3>
                <div className="bg-[#F2F2F7] rounded-2xl overflow-hidden">
                  {[
                    ['Admission Date', formatDate(patient.admissionDate)],
                    ['Sub-Category', patient.currentSubStatus],
                    ['Days Admitted', patient.daysAdmitted],
                    ['Next Assessment', patient.assessments.slice(-1)[0]?.nextDue ? formatDate(patient.assessments.slice(-1)[0].nextDue) : '—'],
                    ['Next Renewal', patient.nextActionDue !== '—' ? formatDate(patient.nextActionDue) : '—'],
                  ].map(([label, value], i, arr) => (
                    <div key={String(label)} className={cn('flex items-center justify-between px-4 py-3 min-h-[44px]', i < arr.length - 1 && 'ios-separator')}>
                      <span className="text-[13px] text-[#8E8E93]">{label}</span>
                      <span className="text-[13px] font-semibold text-[#000000]">{String(value)}</span>
                    </div>
                  ))}
                </div>
                <SubCategoryBar daysAdmitted={patient.daysAdmitted} />
              </div>

              {/* Patient Timeline */}
              <div className="md:col-span-2">
                <h3 className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">Timeline</h3>
                <div className="relative pl-6">
                  <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-[#E5E5EA] rounded-full" />
                  {(() => {
                    const today = new Date().toISOString().split('T')[0]

                    // Deduplicate assessments: keep only the last recorded per date
                    const dedupedAssessments = Object.values(
                      patient.assessments.reduce((acc, a) => {
                        if (!acc[a.date] || a.id > acc[a.date].id) acc[a.date] = a
                        return acc
                      }, {} as Record<string, typeof patient.assessments[0]>)
                    )

                    // Past events — ALL of them, no slice
                    const past = [
                      ...patient.admissionHistory.map(ep => ({ date: ep.startDate, label: `${ep.type} Admission`, sub: ep.subType, color: '#007AFF', future: false, key: `adm-${ep.id}` })),
                      ...dedupedAssessments.map(a => ({ date: a.date, label: `Assessment: ${a.result}`, sub: a.conductedBy, color: a.result === 'Pass' ? '#34C759' : '#FF3B30', future: false, key: `ca-${a.id}` })),
                      ...patient.notes.map(n => ({ date: n.date, label: `Note: ${n.type}`, sub: n.author, color: '#8E8E93', future: false, key: `note-${n.id}` })),
                      ...patient.patientTransfers.map(t => ({ date: t.date, label: `Shifted: ${t.fromType} → ${t.toType}`, sub: t.reason || 'Type shift', color: '#AF52DE', future: false, key: `tr-${t.id}` })),
                    ].filter(e => e.date <= today)
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

                    // Upcoming scheduled CAs
                    const upcoming: { date: string; label: string; sub: string; color: string; future: boolean; milestoneShift?: { from: string; to: string } }[] = []
                    if (patient.admissionType !== 'Discharged' && patient.admissionType !== 'Minor' && patient.admissionDate) {
                      const admDate = patient.admissionDate
                      // hsOriginDate: for milestone boundaries (Day 31, 91, 121, 181 from original HS start)
                      const hsOrigin = (patient as any).hsOriginDate || admDate
                      // hsBase: for CA scheduling (from when current sub-category began)
                      const hsBase = patient.hsStartDate || admDate

                      function addD(d: string, n: number) {
                        const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0]
                      }

                      // CHS milestone boundaries — show ALL (past and future)
                      if (patient.admissionType === 'High Support') {
                        const milestones: [number, string, string, string][] = [
                          [30,  'Shift to CHS — Decision Required (Day 31)', 'HS ≤30 days',   'CHS >30 days'],
                          [90,  'CHS: >30 → >90 days (Day 91)',             'CHS >30 days',  'CHS >90 days'],
                          [120, 'CHS: >90 → >120 days (Day 121)',           'CHS >90 days',  'CHS >120 days'],
                          [180, 'CHS: >120 → >180 days (Day 181)',          'CHS >120 days', 'CHS >180 days'],
                          [361, 'CHS: >180 days renewal (Day 362)',           'CHS >180 days', 'CHS >180 days'],
                        ]
                        for (const [day, label, fromSub, toSub] of milestones) {
                          const d = addD(hsOrigin, day)
                          const isFuture = d > today
                          if (!isFuture && patient.patientTransfers.some(t => Math.abs(new Date(t.date).getTime() - new Date(d).getTime()) <= 2 * 86400000)) continue
                          upcoming.push({ date: d, label, sub: `Day ${day} from HS start (${formatDate(hsOrigin)})`, color: '#FF9500', future: isFuture, milestoneShift: isFuture ? undefined : { from: fromSub, to: toSub } })
                        }
                      }

                      if (patient.admissionType === 'High Support' && patient.currentSubStatus === 'HS ≤30 days') {
                        for (let w = 1; w <= 4; w++) {
                          const d = addD(hsBase, w * 7)
                          if (d < hsBase) continue
                          const slotTime = new Date(d).getTime()
                          const alreadyRecorded = patient.assessments.some(a => {
                            const diff = Math.abs(new Date(a.date).getTime() - slotTime)
                            return diff <= 3 * 86400000
                          })
                          if (alreadyRecorded) continue
                          const isFuture = d > today
                          upcoming.push({
                            date: d,
                            label: `CA Due — HS Week ${w}`,
                            sub: isFuture ? 'Weekly assessment' : 'Scheduled — not yet recorded',
                            color: isFuture ? '#5856D6' : '#FF9500',
                            future: isFuture,
                          })
                        }
                      } else if (patient.currentSubStatus.startsWith('CHS')) {
                        // Show all fortnightly CAs from hsBase onwards (past unrecorded + future)
                        const limit = addD(today, 180)
                        const lastCADate = patient.assessments.slice(-1)[0]?.date ?? hsBase
                        const effectiveBase = lastCADate > hsBase ? lastCADate : hsBase
                        // Also generate past missed CAs from hsBase up to effectiveBase
                        let pastNext = addD(hsBase, 14)
                        while (pastNext < effectiveBase) {
                          const slotTime = new Date(pastNext).getTime()
                          const alreadyRecorded = patient.assessments.some(a => Math.abs(new Date(a.date).getTime() - slotTime) <= 3 * 86400000)
                          if (!alreadyRecorded) {
                            upcoming.push({
                              date: pastNext,
                              label: `CA Due — ${patient.currentSubStatus}`,
                              sub: 'Scheduled — not yet recorded',
                              color: '#FF9500',
                              future: false,
                            })
                          }
                          pastNext = addD(pastNext, 14)
                        }
                        // Future CAs from effectiveBase
                        let next = addD(effectiveBase, 14)
                        while (next <= limit) {
                          const alreadyRecorded = patient.assessments.some(a => {
                            const diff = Math.abs(new Date(a.date).getTime() - new Date(next).getTime())
                            return diff <= 3 * 86400000
                          })
                          if (!alreadyRecorded) {
                            const isFuture = next > today
                            upcoming.push({
                              date: next,
                              label: `CA Due — ${patient.currentSubStatus}`,
                              sub: isFuture ? 'Fortnightly assessment' : 'Scheduled — not yet recorded',
                              color: isFuture ? '#5856D6' : '#FF9500',
                              future: isFuture,
                            })
                          }
                          next = addD(next, 14)
                        }
                      }
                    }
                    const upcomingSorted = upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

                    const allEvents = [...upcomingSorted.reverse(), ...past]

                    return allEvents.map((evt, i) => { const evtKey = (evt as any).key ?? `evt-${i}`
                      const daysUntil = Math.floor((new Date(evt.date).getTime() - new Date(today).getTime()) / 86400000)
                      const timeLabel = evt.future
                        ? daysUntil === 0 ? 'Today' : `in ${daysUntil}d`
                        : relativeDate(evt.date)
                      const isPendingCA = !evt.future && evt.sub.includes('not yet recorded')
                      const slotTime = new Date(evt.date).getTime()
                      const alreadyRecordedInDB = patient.assessments.some(a => {
                        const diff = Math.abs(new Date(a.date).getTime() - slotTime)
                        return diff <= 3 * 86400000
                      })
                      const isDone = alreadyRecordedInDB

                      return (
                        <div key={evtKey} className={cn('relative flex items-start gap-3 pb-4', evt.future && 'opacity-70')}>
                          <div
                            className="absolute left-[-17px] top-1.5 w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: evt.future ? 'transparent' : (isDone && isPendingCA ? '#34C759' : evt.color),
                              border: evt.future ? `2px solid ${evt.color}` : '2px solid white',
                              boxShadow: evt.future ? `0 0 0 1px ${evt.color}` : 'none',
                            }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                {evt.future && <Clock className="w-3 h-3 shrink-0" style={{ color: evt.color }} />}
                                <p className="text-[13px] font-medium" style={{ color: evt.future ? evt.color : (isDone && isPendingCA ? '#34C759' : '#000000') }}>
                                  {evt.label}
                                </p>
                              </div>
                              {isPendingCA && (
                                isDone ? (
                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-[#34C759]/10 text-[#34C759] rounded-full text-[11px] font-semibold shrink-0">
                                    <CheckCircle2 className="w-3 h-3" /> Recorded
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => { setNewAssessment(s => ({ ...s, date: evt.date })); setAssessmentModal(true) }}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-[#FF9500] text-white rounded-full text-[11px] font-semibold shrink-0 active:opacity-80"
                                  >
                                    <Plus className="w-3 h-3" /> Record
                                  </button>
                                )
                              )}
                              {(evt as any).milestoneShift && (() => {
                                const ms = (evt as any).milestoneShift as { from: string; to: string }
                                const alreadyShifted = patient.patientTransfers.some(t => t.toType === ms.to)
                                  || patient.currentSubStatus === ms.to
                                  || patient.patientTransfers.some(t => {
                                    const order = ['HS ≤30 days','CHS >30 days','CHS >90 days','CHS >120 days','CHS >180 days']
                                    return order.indexOf(t.toType) >= order.indexOf(ms.to)
                                  })
                                return alreadyShifted ? (
                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-[#34C759]/10 text-[#34C759] rounded-full text-[11px] font-semibold shrink-0">
                                    <CheckCircle2 className="w-3 h-3" /> Shifted
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleShiftToCHSFromTimeline(evt.date, ms.from, ms.to)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-[#FF9500] text-white rounded-full text-[11px] font-semibold shrink-0 active:opacity-80"
                                  >
                                    <ArrowLeftRight className="w-3 h-3" /> Shift
                                  </button>
                                )
                              })()}
                            </div>
                            <p className="text-[11px] text-[#8E8E93] mt-0.5">{evt.sub} · {formatDate(evt.date)} · {timeLabel}</p>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* History */}
          {activeTab === 1 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#F2F2F7]/60">
                    {['#', 'Type', 'Sub-Type', 'Start', 'End', 'Reason', 'Duration'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[#8E8E93] font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patient.admissionHistory.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-[#8E8E93] text-[14px]">No admission history</td></tr>
                  ) : patient.admissionHistory.map((ep, i) => (
                    <tr key={ep.id} className="ios-separator last:[border-bottom:none]">
                      <td className="px-5 py-3 text-[#8E8E93]">#{i + 1}</td>
                      <td className="px-5 py-3"><AdmissionTypeBadge type={ep.type} /></td>
                      <td className="px-5 py-3 text-[#3A3A3C]">{ep.subType}</td>
                      <td className="px-5 py-3 text-[#3A3A3C]">{formatDate(ep.startDate)}</td>
                      <td className="px-5 py-3">{ep.endDate ? formatDate(ep.endDate) : <span className="text-[#34C759] font-medium">Active</span>}</td>
                      <td className="px-5 py-3 text-[#3A3A3C]">{ep.reasonForEnd || '—'}</td>
                      <td className="px-5 py-3 text-[#3A3A3C]">{ep.duration ? `${ep.duration}d` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Assessments */}
          {activeTab === 2 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#000000]">Assessments <span className="text-[#8E8E93] font-normal text-[13px]">({patient.assessments.length})</span></h3>
                  {patient.assessments.length > 0 && patient.assessments.slice(-1)[0]?.nextDue && (
                    <p className="text-[13px] text-[#FF9500] font-medium mt-0.5">Next due: {formatDate(patient.assessments.slice(-1)[0].nextDue)}</p>
                  )}
                </div>
                <button onClick={() => setAssessmentModal(true)}
                  className="flex items-center gap-1.5 bg-[#007AFF] text-white px-4 py-2 rounded-xl text-[13px] font-medium active:opacity-80">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {patient.assessments.length === 0 ? (
                <div className="text-center py-12 text-[#8E8E93]">
                  <Brain className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-[14px] font-medium">No assessments</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-[#F2F2F7]/60">
                        {['Date', 'By', 'Result', 'Next Due', 'Notes'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[#8E8E93] font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...patient.assessments].reverse().map((a) => (
                        <tr key={a.id} className="ios-separator last:[border-bottom:none]">
                          <td className="px-5 py-3 text-[#3A3A3C]">{formatDate(a.date)}</td>
                          <td className="px-5 py-3 text-[#3A3A3C]">{a.conductedBy}</td>
                          <td className="px-5 py-3"><StatusBadge status={a.result} /></td>
                          <td className="px-5 py-3 text-[#3A3A3C]">{a.nextDue ? formatDate(a.nextDue) : '—'}</td>
                          <td className="px-5 py-3 text-[#8E8E93] max-w-xs truncate">{a.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {activeTab === 3 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[15px] font-semibold text-[#000000]">Notes</h3>
                <button onClick={() => setShowNoteForm(!showNoteForm)}
                  className="flex items-center gap-1.5 bg-[#007AFF] text-white px-4 py-2 rounded-xl text-[13px] font-medium active:opacity-80">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {showNoteForm && (
                <div className="mb-4 p-5 bg-[#F2F2F7] rounded-2xl space-y-3">
                  <div className="flex gap-3">
                    <select value={noteType} onChange={e => setNoteType(e.target.value as any)}
                      className="bg-white rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
                      {['Clinical', 'Administrative', 'Legal'].map(t => <option key={t}>{t}</option>)}
                    </select>
                    <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)}
                      className="bg-white rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                  </div>
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Write note..."
                    rows={3} className="w-full bg-white rounded-xl px-4 py-3 text-[14px] resize-none outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowNoteForm(false)} className="px-4 py-2 text-[13px] bg-[#E5E5EA] rounded-xl active:bg-[#D1D1D6]">Cancel</button>
                    <button onClick={handleAddNote} className="px-4 py-2 text-[13px] bg-[#007AFF] text-white rounded-xl active:opacity-80">Save</button>
                  </div>
                </div>
              )}
              <div className="space-y-2.5">
                {patient.notes.map(n => (
                  <div key={n.id} className="p-4 rounded-2xl bg-[#F2F2F7]">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[13px] text-[#000000]">{n.author}</span>
                        <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', {
                          'bg-[#007AFF]/12 text-[#007AFF]': n.type === 'Clinical',
                          'bg-[#8E8E93]/12 text-[#8E8E93]': n.type === 'Administrative',
                          'bg-[#FF3B30]/12 text-[#FF3B30]': n.type === 'Legal',
                        })}>{n.type}</span>
                      </div>
                      <span className="text-[11px] text-[#C7C7CC]">{relativeDate(n.date)}</span>
                    </div>
                    <p className="text-[14px] text-[#3A3A3C] leading-relaxed">{n.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Assessment Modal */}
      <Modal open={assessmentModal} onClose={() => setAssessmentModal(false)} title="Add Assessment">
        <div className="space-y-4">
          {newAssessment.result === 'Pass' && (patient.admissionType === 'High Support' || patient.currentSubStatus.startsWith('CHS')) && (
            <div className="flex items-start gap-2.5 p-4 bg-[#34C759]/10 rounded-2xl">
              <CheckCircle2 className="w-4 h-4 text-[#34C759] mt-0.5 shrink-0" />
              <p className="text-[12px] text-[#34C759]">Pass will automatically shift this patient to Independent.</p>
            </div>
          )}
          {newAssessment.result === 'Fail' && patient.admissionType === 'Independent' && (
            <div className="flex items-start gap-2.5 p-4 bg-[#FF3B30]/10 rounded-2xl">
              <CheckCircle2 className="w-4 h-4 text-[#FF3B30] mt-0.5 shrink-0" />
              <p className="text-[12px] text-[#FF3B30]">Fail — patient has lost capacity. This will shift them to High Support.</p>
            </div>
          )}
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Date</label>
            <input type="date" value={newAssessment.date} onChange={e => setNewAssessment(s => ({ ...s, date: e.target.value }))}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Assessed By</label>
            <input value={newAssessment.conductedBy} onChange={e => setNewAssessment(s => ({ ...s, conductedBy: e.target.value }))}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Result</label>
            <select value={newAssessment.result} onChange={e => setNewAssessment(s => ({ ...s, result: e.target.value as any }))}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Notes</label>
            <textarea rows={3} value={newAssessment.notes} onChange={e => setNewAssessment(s => ({ ...s, notes: e.target.value }))}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] resize-none outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAssessmentModal(false)} className="px-5 py-2.5 text-[14px] bg-[#E5E5EA] rounded-xl active:bg-[#D1D1D6]">Cancel</button>
            <button onClick={handleSaveAssessment} className="px-5 py-2.5 text-[14px] bg-[#007AFF] text-white rounded-xl font-medium active:opacity-80">Save</button>
          </div>
        </div>
      </Modal>

      {/* Discharge Modal */}
      <Modal open={dischargeModal} onClose={() => setDischargeModal(false)} title="Confirm Discharge" size="sm">
        <div className="space-y-4">
          <div className="p-4 bg-[#FF3B30]/10 rounded-2xl">
            <p className="text-[13px] text-[#FF3B30]">Discharge <strong>{patient.name}</strong>? This cannot be undone.</p>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Discharge Date</label>
            <input type="date" value={dischargeDate} onChange={e => setDischargeDate(e.target.value)}
              className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Reason</label>
            <select value={dischargeReason} onChange={e => setDischargeReason(e.target.value)}
              className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
              <option>Clinical Decision</option>
              <option>Capacity Regained</option>
              <option>Voluntary</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDischargeModal(false)} className="px-5 py-2.5 text-[14px] bg-[#E5E5EA] rounded-xl active:bg-[#D1D1D6]">Cancel</button>
            <button onClick={handleDischarge} className="px-5 py-2.5 text-[14px] bg-[#FF3B30] text-white rounded-xl font-medium active:opacity-80">Discharge</button>
          </div>
        </div>
      </Modal>

      {/* Shift Type Modal */}
      <Modal open={shiftModal} onClose={() => { setShiftModal(false); setShiftDone(false); setShiftReason('') }} title="Shift Admission Type" size="sm">
        <div className="space-y-4">
          {shiftDone ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-14 h-14 rounded-full bg-[#34C759]/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-[#34C759]" />
              </div>
              <p className="text-[15px] font-semibold text-[#34C759]">Shifted ✓</p>
              <p className="text-[13px] text-[#8E8E93]">{patient.name} moved to {shiftTo === 'High Support' ? 'HS ≤30 days' : shiftTo}</p>
            </div>
          ) : (
            <>
              <div className="bg-[#F2F2F7] rounded-2xl p-4 space-y-2 text-[13px]">
                <div className="flex justify-between"><span className="text-[#8E8E93]">Current</span><span className="font-semibold text-[#000000]">{patient.currentSubStatus}</span></div>
                <div className="flex justify-between"><span className="text-[#8E8E93]">Shift to</span><span className="font-semibold text-[#007AFF]">{shiftTo === 'High Support' ? 'HS ≤30 days' : shiftTo}</span></div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Shift Date</label>
                <input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)}
                  className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Shift To</label>
                <select value={shiftTo} onChange={e => setShiftTo(e.target.value)}
                  className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
                  <optgroup label="Standard">
                    <option value="Independent">Independent</option>
                    <option value="High Support">High Support (HS ≤30 days)</option>
                  </optgroup>
                  <optgroup label="Continuous High Support">
                    {CHS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Reason <span className="text-[#8E8E93] font-normal">(optional)</span></label>
                <input value={shiftReason} onChange={e => setShiftReason(e.target.value)} placeholder="Reason for shift"
                  className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShiftModal(false); setShiftReason('') }} className="px-5 py-2.5 text-[14px] bg-[#E5E5EA] rounded-xl active:bg-[#D1D1D6]">Cancel</button>
                <button onClick={handleShiftType} className="px-5 py-2.5 text-[14px] bg-[#007AFF] text-white rounded-xl font-medium active:opacity-80">Confirm Shift</button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
