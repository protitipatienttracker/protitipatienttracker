'use client'
import { useState } from 'react'
import { ArrowLeft, Edit, LogOut, Plus, CheckCircle2, Brain, Phone, Mail, FileText, ArrowLeftRight } from 'lucide-react'
import { StatusBadge, AdmissionTypeBadge } from '@/components/ui/badge-status'
import { Modal } from '@/components/ui/modal'
import { formatDate, type Patient, type Assessment, type Note, type BillingPeriod } from '@/lib/data'
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
  markBillingPaid, updateSubCategory, insertTransfer, insertNotification,
  getNextAssessmentDate, updatePatientField, undoDischarge,
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

function SubCategoryBar({ daysAdmitted }: { daysAdmitted: number }) {
  const milestones = [0, 30, 90, 120, 180]
  const max = 180
  const pct = Math.min((daysAdmitted / max) * 100, 100)
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[11px] text-[#8E8E93] mb-1">
        {milestones.map(m => <span key={m}>{m}d</span>)}
      </div>
      <div className="relative h-3 bg-[#E5E5EA] rounded-full overflow-visible">
        <div className="absolute h-full bg-gradient-to-r from-[#007AFF] to-[#5AC8FA] rounded-full" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#007AFF] rounded-full shadow-sm" style={{ left: `calc(${pct}% - 8px)` }} />
        {milestones.slice(1).map(m => (
          <div key={m} className="absolute top-0 bottom-0 w-px bg-[#C7C7CC]" style={{ left: `${(m / max) * 100}%` }} />
        ))}
      </div>
      <p className="text-[13px] text-[#8E8E93] mt-2">Day {daysAdmitted} of 180</p>
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
}

export default function PatientDetail({ patient, onBack, onNavigate, onAddToast, onUpdatePatient, onRefreshPatient }: Props) {
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
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [billingOrder, setBillingOrder] = useState<string[]>(patient.billingPeriods.map(b => b.id))
  const [shiftModal, setShiftModal] = useState(false)
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().split('T')[0])
  const [shiftTo, setShiftTo] = useState<'Independent' | 'High Support'>(patient.admissionType === 'Independent' ? 'High Support' : 'Independent')
  const [shiftReason, setShiftReason] = useState('')

  const [newAssessment, setNewAssessment] = useState({
    date: new Date().toISOString().split('T')[0],
    conductedBy: 'Arjun Sathe',
    result: 'Pass' as 'Pass' | 'Fail',
    notes: '',
  })

  const tabs = ['Overview', 'History', 'Assessments', 'Notes', 'Billing']

  async function handleSaveAssessment() {
    if (!patient.activeAdmissionId) { onAddToast('error', 'No active admission'); return }
    const nextDue = getNextAssessmentDate(patient.admissionDate, newAssessment.date)
    const { error } = await addCapacityAssessment({
      patient_id: patient.id,
      admission_id: patient.activeAdmissionId,
      assessment_date: newAssessment.date,
      assessed_by: newAssessment.conductedBy,
      result: newAssessment.result,
      notes: newAssessment.notes || null,
      next_assessment_due: nextDue.toISOString().split('T')[0],
    })
    if (error) { onAddToast('error', 'Failed', error.message); return }
    if (newAssessment.result === 'Pass' && patient.admissionType === 'High Support') {
      await updateSubCategory(patient.activeAdmissionId, 'Independent')
      await insertTransfer({
        patient_id: patient.id, from_admission_id: patient.activeAdmissionId,
        to_admission_id: patient.activeAdmissionId, transfer_date: newAssessment.date,
        from_type: patient.currentSubStatus, to_type: 'Independent',
        reason: 'Capacity assessment passed', triggered_by: 'System', notes: newAssessment.notes || null,
      })
      onAddToast('success', 'Shifted to Independent')
    } else {
      onAddToast('success', 'Assessment recorded')
    }
    setAssessmentModal(false)
    if (onRefreshPatient) await onRefreshPatient(patient.id)
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

  async function handleShiftType() {
    if (!patient.activeAdmissionId || !shiftReason.trim()) { onAddToast('error', 'Please fill reason'); return }
    const newSub = shiftTo === 'High Support' ? 'HS ≤30 days' : 'Independent'
    await updateSubCategory(patient.activeAdmissionId, newSub)
    await insertTransfer({
      patient_id: patient.id, from_admission_id: patient.activeAdmissionId,
      to_admission_id: patient.activeAdmissionId, transfer_date: shiftDate,
      from_type: patient.currentSubStatus, to_type: newSub,
      reason: shiftReason, triggered_by: 'Arjun Sathe', notes: null,
    })
    setShiftModal(false)
    onAddToast('success', `Shifted to ${shiftTo}`, `Effective ${shiftDate}`)
    if (onRefreshPatient) await onRefreshPatient(patient.id)
  }

  async function handleAddNote() {
    if (!noteText.trim() || !patient.activeAdmissionId) return
    const { error } = await addClinicalNote({
      patient_id: patient.id, admission_id: patient.activeAdmissionId,
      note_date: noteDate, author: 'Arjun Sathe', note_type: noteType, content: noteText,
    })
    if (error) { onAddToast('error', 'Failed', error.message); return }
    setNoteText(''); setShowNoteForm(false)
    onAddToast('success', 'Note added')
    if (onRefreshPatient) await onRefreshPatient(patient.id)
  }

  async function handleMarkBillingPaid(billId: string) {
    const { error } = await markBillingPaid(billId)
    if (error) { onAddToast('error', 'Failed', error.message); return }
    onAddToast('success', 'Marked as paid')
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
        <div className="h-20 bg-gradient-to-r from-[#007AFF] to-[#5856D6] relative" />
        <div className="px-6 pb-5 -mt-8">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <Avatar name={patient.name} />
            <div className="flex-1 min-w-0 pt-2">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-[20px] font-bold text-[#000000]">{patient.name}</h1>
                <AdmissionTypeBadge type={patient.admissionType} />
                <StatusBadge status={patient.status} />
              </div>
              <div className="flex flex-wrap gap-3 text-[13px] text-[#8E8E93]">
                <span className="font-mono">{patient.id}</span>
                <span>Age {patient.age}</span>
                <span>{patient.gender}</span>
                <span>Dr. {patient.treatingDoctor.replace('Dr. ', '')}</span>
              </div>
              {/* Quick Action Chips */}
              <div className="flex flex-wrap gap-2 mt-3">
                {patient.phone && (
                  <a href={`tel:${patient.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#34C759]/10 text-[#34C759] rounded-full text-[12px] font-medium">
                    <Phone className="w-3 h-3" /> Call
                  </a>
                )}
                <button onClick={() => { setShowNoteForm(true); setActiveTab(3) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#007AFF]/10 text-[#007AFF] rounded-full text-[12px] font-medium">
                  <FileText className="w-3 h-3" /> Add Note
                </button>
                {patient.admissionType !== 'Discharged' && (
                  <button onClick={() => setAssessmentModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5856D6]/10 text-[#5856D6] rounded-full text-[12px] font-medium">
                    <Brain className="w-3 h-3" /> Assessment
                  </button>
                )}
                {patient.admissionType !== 'Discharged' && patient.admissionType !== 'Minor' && (
                  <button onClick={() => setShiftModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF9500]/10 text-[#FF9500] rounded-full text-[12px] font-medium">
                    <ArrowLeftRight className="w-3 h-3" /> Shift Type
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button className="flex items-center gap-1.5 px-4 py-2.5 bg-[#E5E5EA] rounded-xl text-[13px] text-[#3A3A3C] font-medium active:bg-[#D1D1D6]">
                <Edit className="w-3.5 h-3.5" />
                Edit
              </button>
              {patient.admissionType !== 'Discharged' && (
                <button onClick={() => setDischargeModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#FF3B30]/10 rounded-xl text-[13px] text-[#FF3B30] font-medium active:bg-[#FF3B30]/20">
                  <LogOut className="w-3.5 h-3.5" />
                  Discharge
                </button>
              )}
            </div>
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

        <div className="p-6">
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
                  {[
                    ...patient.admissionHistory.map(ep => ({ date: ep.startDate, label: `${ep.type} Admission`, sub: ep.subType, color: '#007AFF' })),
                    ...patient.assessments.map(a => ({ date: a.date, label: `Assessment: ${a.result}`, sub: a.conductedBy, color: a.result === 'Pass' ? '#34C759' : '#FF3B30' })),
                    ...patient.notes.map(n => ({ date: n.date, label: `Note: ${n.type}`, sub: n.author, color: '#8E8E93' })),
                    ...patient.billingPeriods.map(b => ({ date: b.from, label: `Billing: ${b.period}`, sub: `₹${b.amount.toLocaleString('en-IN')}`, color: '#FF9500' })),
                  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8).map((evt, i) => (
                    <div key={i} className="relative flex items-start gap-3 pb-4">
                      <div className="absolute left-[-17px] top-1.5 w-3 h-3 rounded-full border-2 border-white" style={{ backgroundColor: evt.color }} />
                      <div>
                        <p className="text-[13px] font-medium text-[#000000]">{evt.label}</p>
                        <p className="text-[11px] text-[#8E8E93]">{evt.sub} · {relativeDate(evt.date)}</p>
                      </div>
                    </div>
                  ))}
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
                  {patient.admissionHistory.map((ep, i) => (
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
                  <h3 className="text-[15px] font-semibold text-[#000000]">Assessments</h3>
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
                      {patient.assessments.map((a) => (
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

          {/* Billing */}
          {activeTab === 4 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#F2F2F7]/60">
                    {['', 'Period', 'From', 'To', 'Sub-Category', 'Amount', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[#8E8E93] font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(billingOrder.map(id => patient.billingPeriods.find(b => b.id === id)).filter(Boolean) as typeof patient.billingPeriods).map((b, i) => (
                    <tr
                      key={b.id}
                      draggable
                      onDragStart={() => setDragIdx(i)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => {
                        if (dragIdx === null) return
                        const newOrder = [...billingOrder]
                        const [moved] = newOrder.splice(dragIdx, 1)
                        newOrder.splice(i, 0, moved)
                        setBillingOrder(newOrder)
                        setDragIdx(null)
                      }}
                      className={cn('ios-separator last:[border-bottom:none] transition-all', dragIdx === i && 'opacity-50')}
                    >
                      <td className="px-5 py-3 cursor-grab active:cursor-grabbing text-[#C7C7CC]">⠿</td>
                      <td className="px-5 py-3 font-medium text-[#000000]">{b.period}</td>
                      <td className="px-5 py-3 text-[#3A3A3C]">{formatDate(b.from)}</td>
                      <td className="px-5 py-3 text-[#3A3A3C]">{formatDate(b.to)}</td>
                      <td className="px-5 py-3 text-[#3A3A3C]">{b.subCategory}</td>
                      <td className="px-5 py-3 font-semibold text-[#000000]">₹{b.amount.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-5 py-3">
                        {b.status === 'Pending' && (
                          <button onClick={() => handleMarkBillingPaid(b.id)}
                            className="text-[13px] text-[#007AFF] font-medium active:opacity-60">Mark Paid</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Assessment Modal */}
      <Modal open={assessmentModal} onClose={() => setAssessmentModal(false)} title="Add Assessment">
        <div className="space-y-4">
          {newAssessment.result === 'Pass' && (
            <div className="flex items-start gap-2.5 p-4 bg-[#34C759]/10 rounded-2xl">
              <CheckCircle2 className="w-4 h-4 text-[#34C759] mt-0.5 shrink-0" />
              <p className="text-[12px] text-[#34C759]">Pass triggers a shift to Independent.</p>
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
      <Modal open={shiftModal} onClose={() => setShiftModal(false)} title="Shift Admission Type" size="sm">
        <div className="space-y-4">
          <div className="bg-[#F2F2F7] rounded-2xl p-4 space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-[#8E8E93]">Current</span><span className="font-semibold text-[#000000]">{patient.admissionType}</span></div>
            <div className="flex justify-between"><span className="text-[#8E8E93]">Shift to</span><span className="font-semibold text-[#007AFF]">{shiftTo}</span></div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Shift Date</label>
            <input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)}
              className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Shift To</label>
            <select value={shiftTo} onChange={e => setShiftTo(e.target.value as any)}
              className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
              <option value="Independent">Independent</option>
              <option value="High Support">High Support</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Reason</label>
            <input value={shiftReason} onChange={e => setShiftReason(e.target.value)} placeholder="Reason for shift"
              className="w-full bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShiftModal(false)} className="px-5 py-2.5 text-[14px] bg-[#E5E5EA] rounded-xl active:bg-[#D1D1D6]">Cancel</button>
            <button onClick={handleShiftType} className="px-5 py-2.5 text-[14px] bg-[#007AFF] text-white rounded-xl font-medium active:opacity-80">Confirm Shift</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
