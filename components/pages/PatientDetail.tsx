'use client'
import { useState } from 'react'
import { ArrowLeft, Edit, LogOut, Plus, CheckCircle2, Brain } from 'lucide-react'
import { StatusBadge, AdmissionTypeBadge } from '@/components/ui/badge-status'
import { Modal } from '@/components/ui/modal'
import { formatDate, type Patient, type Assessment, type Note, type BillingPeriod } from '@/lib/data'
import { cn } from '@/lib/utils'
import {
  addCapacityAssessment, dischargePatient, addClinicalNote,
  markBillingPaid, updateSubCategory, insertTransfer, insertNotification,
  getNextAssessmentDate,
} from '@/lib/db'

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500']
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
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        {milestones.map(m => <span key={m}>{m}d</span>)}
      </div>
      <div className="relative h-3 bg-slate-100 rounded-full overflow-visible">
        <div
          className="absolute h-full bg-gradient-to-r from-[#0D6E6E] to-teal-400 rounded-full"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#0D6E6E] rounded-full shadow-sm"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
        {milestones.slice(1).map(m => (
          <div
            key={m}
            className="absolute top-0 bottom-0 w-px bg-slate-300"
            style={{ left: `${(m / max) * 100}%` }}
          />
        ))}
      </div>
      <p className="text-sm text-slate-500 mt-2">Day {daysAdmitted} of 180</p>
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
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState<'Clinical' | 'Administrative' | 'Legal'>('Clinical')
  const [showNoteForm, setShowNoteForm] = useState(false)

  const [newAssessment, setNewAssessment] = useState({
    date: new Date().toISOString().split('T')[0],
    conductedBy: 'Arjun Sathe',
    result: 'Pass' as 'Pass' | 'Fail',
    notes: '',
  })

  const tabs = ['Overview', 'Admission History', 'Capacity Assessments', 'Documents & Notes', 'Billing Periods']

  async function handleSaveAssessment() {
    if (!patient.activeAdmissionId) {
      onAddToast('error', 'No active admission found')
      return
    }
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
    if (error) {
      onAddToast('error', 'Failed to save assessment', error.message)
      return
    }
    // If Pass → shift to Independent and create transfer record
    if (newAssessment.result === 'Pass' && patient.admissionType === 'High Support') {
      await updateSubCategory(patient.activeAdmissionId, 'Independent')
      await insertTransfer({
        patient_id: patient.id,
        from_admission_id: patient.activeAdmissionId,
        to_admission_id: patient.activeAdmissionId,
        transfer_date: newAssessment.date,
        from_type: patient.currentSubStatus,
        to_type: 'Independent',
        reason: 'Capacity assessment passed',
        triggered_by: 'System',
        notes: newAssessment.notes || null,
      })
      onAddToast('success', 'Assessment recorded — shifted to Independent')
    } else {
      onAddToast('success', 'Assessment recorded', `Result: ${newAssessment.result}`)
    }
    setAssessmentModal(false)
    if (onRefreshPatient) await onRefreshPatient(patient.id)
  }

  async function handleDischarge() {
    if (!patient.activeAdmissionId) {
      onAddToast('error', 'No active admission found')
      return
    }
    const today = new Date().toISOString().split('T')[0]
    const { error } = await dischargePatient(patient.activeAdmissionId, 'Clinical Decision', today)
    if (error) {
      onAddToast('error', 'Discharge failed', error.message)
      return
    }
    await insertNotification({
      patient_id: patient.id,
      type: 'Discharge',
      message: `${patient.name} has been discharged.`,
      due_date: today,
    })
    setDischargeModal(false)
    onAddToast('success', 'Patient discharged', `${patient.name} has been discharged.`)
    onBack()
  }

  async function handleAddNote() {
    if (!noteText.trim() || !patient.activeAdmissionId) return
    const { error } = await addClinicalNote({
      patient_id: patient.id,
      admission_id: patient.activeAdmissionId,
      note_date: new Date().toISOString().split('T')[0],
      author: 'Arjun Sathe',
      note_type: noteType,
      content: noteText,
    })
    if (error) {
      onAddToast('error', 'Failed to add note', error.message)
      return
    }
    setNoteText('')
    setShowNoteForm(false)
    onAddToast('success', 'Note added')
    if (onRefreshPatient) await onRefreshPatient(patient.id)
  }

  async function handleMarkBillingPaid(billId: string) {
    const { error } = await markBillingPaid(billId)
    if (error) {
      onAddToast('error', 'Failed to update billing', error.message)
      return
    }
    onAddToast('success', 'Billing period marked as paid')
    if (onRefreshPatient) await onRefreshPatient(patient.id)
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#0D6E6E] hover:underline">
        <ArrowLeft className="w-4 h-4" />
        Back to All Patients
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <Avatar name={patient.name} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-slate-800">{patient.name}</h1>
              <AdmissionTypeBadge type={patient.admissionType} />
              <StatusBadge status={patient.status} />
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-500">
              <span className="font-mono">{patient.id}</span>
              <span>Age {patient.age}</span>
              <span>{patient.gender}</span>
              <span>Dr. {patient.treatingDoctor.replace('Dr. ', '')}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
              <Edit className="w-3.5 h-3.5" />
              Edit
            </button>
            {patient.admissionType !== 'Discharged' && (
              <button
                onClick={() => setDischargeModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-xs text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                Discharge
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {tabs.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={cn(
                'px-5 py-3.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2',
                activeTab === i
                  ? 'border-[#0D6E6E] text-[#0D6E6E]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Tab 0: Overview */}
          {activeTab === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Personal Details</h3>
                {[
                  ['Date of Birth', patient.dob],
                  ['Phone', patient.phone],
                  ['Emergency Contact', patient.emergencyContactName],
                  ['Emergency Phone', patient.emergencyContactPhone],
                  ['Address', patient.address],
                  ['Admitted By', patient.admittedBy],
                  ['Treating Doctor', patient.treatingDoctor],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-3">
                    <span className="text-sm text-slate-500 w-32 shrink-0">{label}</span>
                    <span className="text-sm text-slate-800 font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Current Admission</h3>
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  {[
                    ['Admission Date', formatDate(patient.admissionDate)],
                    ['Current Sub-Category', patient.currentSubStatus],
                    ['Days Admitted', patient.daysAdmitted],
                    ['Next Assessment', patient.assessments.slice(-1)[0]?.nextDue ? formatDate(patient.assessments.slice(-1)[0].nextDue) : '—'],
                    ['Next Renewal Due', patient.nextActionDue !== '—' ? formatDate(patient.nextActionDue) : '—'],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex justify-between">
                      <span className="text-sm text-slate-500">{label}</span>
                      <span className="text-sm font-semibold text-slate-800">{String(value)}</span>
                    </div>
                  ))}
                  <SubCategoryBar daysAdmitted={patient.daysAdmitted} />
                </div>
              </div>
            </div>
          )}

          {/* Tab 1: Admission History */}
          {activeTab === 1 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Episode', 'Type', 'Sub-Type', 'Start Date', 'End Date', 'Reason', 'Duration'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patient.admissionHistory.map((ep, i) => (
                    <tr key={ep.id} className={cn('border-b border-slate-50', i % 2 === 1 ? 'bg-slate-50/50' : '')}>
                      <td className="px-4 py-3 font-mono text-slate-500">#{i + 1}</td>
                      <td className="px-4 py-3"><AdmissionTypeBadge type={ep.type} /></td>
                      <td className="px-4 py-3 text-slate-700">{ep.subType}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{formatDate(ep.startDate)}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{ep.endDate ? formatDate(ep.endDate) : <span className="text-green-600 font-medium">Active</span>}</td>
                      <td className="px-4 py-3 text-slate-600">{ep.reasonForEnd || '—'}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{ep.duration ? `${ep.duration} days` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Capacity Assessments */}
          {activeTab === 2 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-slate-700">Assessment Records</h3>
                <button
                  onClick={() => setAssessmentModal(true)}
                  className="flex items-center gap-1.5 bg-[#0D6E6E] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#0A5858]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Assessment
                </button>
              </div>
              {patient.assessments.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Brain className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No assessments recorded</p>
                  <p className="text-xs">Click Add Assessment to record one</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {['Date', 'Conducted By', 'Result', 'Next Due', 'Notes'].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {patient.assessments.map((a, i) => (
                        <tr key={a.id} className={cn('border-b border-slate-50', i % 2 === 1 ? 'bg-slate-50/50' : '')}>
                          <td className="px-4 py-3 font-mono text-slate-600">{formatDate(a.date)}</td>
                          <td className="px-4 py-3 text-slate-700">{a.conductedBy}</td>
                          <td className="px-4 py-3"><StatusBadge status={a.result} /></td>
                          <td className="px-4 py-3 font-mono text-slate-600">{a.nextDue ? formatDate(a.nextDue) : '—'}</td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{a.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Notes */}
          {activeTab === 3 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-slate-700">Documents & Notes</h3>
                <button
                  onClick={() => setShowNoteForm(!showNoteForm)}
                  className="flex items-center gap-1.5 bg-[#0D6E6E] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#0A5858]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Note
                </button>
              </div>
              {showNoteForm && (
                <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex gap-3">
                    <select
                      value={noteType}
                      onChange={e => setNoteType(e.target.value as any)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white"
                    >
                      {['Clinical', 'Administrative', 'Legal'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Write note here..."
                    rows={3}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white resize-none outline-none focus:ring-2 focus:ring-[#0D6E6E]/30"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowNoteForm(false)} className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100">Cancel</button>
                    <button onClick={handleAddNote} className="px-3 py-1.5 text-xs bg-[#0D6E6E] text-white rounded-lg hover:bg-[#0A5858]">Save Note</button>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {patient.notes.map(n => (
                  <div key={n.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-700">{n.author}</span>
                        <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', {
                          'bg-blue-100 text-blue-700': n.type === 'Clinical',
                          'bg-slate-100 text-slate-600': n.type === 'Administrative',
                          'bg-red-100 text-red-700': n.type === 'Legal',
                        })}>
                          {n.type}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{formatDate(n.date)}</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{n.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Billing */}
          {activeTab === 4 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Period', 'From', 'To', 'Sub-Category', 'Amount (₹)', 'Status', 'Action'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patient.billingPeriods.map((b, i) => (
                    <tr key={b.id} className={cn('border-b border-slate-50', i % 2 === 1 ? 'bg-slate-50/50' : '')}>
                      <td className="px-4 py-3 font-medium text-slate-700">{b.period}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{formatDate(b.from)}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{formatDate(b.to)}</td>
                      <td className="px-4 py-3 text-slate-600">{b.subCategory}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">₹{b.amount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3">
                        {b.status === 'Pending' && (
                          <button
                            onClick={() => handleMarkBillingPaid(b.id)}
                            className="text-xs text-[#0D6E6E] hover:underline font-medium"
                          >
                            Mark Paid
                          </button>
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
      <Modal open={assessmentModal} onClose={() => setAssessmentModal(false)} title="Add Capacity Assessment">
        <div className="space-y-4">
          {newAssessment.result === 'Pass' && (
            <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <p className="text-xs text-green-700">Pass result will trigger a shift to Independent Admission.</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Assessment Date</label>
            <input type="date" value={newAssessment.date} onChange={e => setNewAssessment(s => ({ ...s, date: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Assessed By</label>
            <input value={newAssessment.conductedBy} onChange={e => setNewAssessment(s => ({ ...s, conductedBy: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Result</label>
            <select value={newAssessment.result} onChange={e => setNewAssessment(s => ({ ...s, result: e.target.value as any }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none bg-white focus:ring-2 focus:ring-[#0D6E6E]/30">
              <option value="Pass">Pass — Patient has capacity</option>
              <option value="Fail">Fail — Patient lacks capacity</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <textarea rows={3} value={newAssessment.notes} onChange={e => setNewAssessment(s => ({ ...s, notes: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAssessmentModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveAssessment} className="px-4 py-2 text-sm bg-[#0D6E6E] text-white rounded-lg hover:bg-[#0A5858]">Save Assessment</button>
          </div>
        </div>
      </Modal>

      {/* Discharge Confirm Modal */}
      <Modal open={dischargeModal} onClose={() => setDischargeModal(false)} title="Confirm Discharge" size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-xs text-red-700">Are you sure you want to discharge <strong>{patient.name}</strong>? This action cannot be undone.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDischargeModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleDischarge} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Confirm Discharge</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
