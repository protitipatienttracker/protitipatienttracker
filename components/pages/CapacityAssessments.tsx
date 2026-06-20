'use client'
import { useState } from 'react'
import { Plus, Eye } from 'lucide-react'
import { StatusBadge, AdmissionTypeBadge } from '@/components/ui/badge-status'
import { Modal } from '@/components/ui/modal'
import { formatDate, daysBetween, DOCTORS, type Patient } from '@/lib/data'
import { cn } from '@/lib/utils'
import { addCapacityAssessment, updateSubCategory, insertTransfer, getNextAssessmentDate } from '@/lib/db'

interface Props {
  patients: Patient[]
  onViewPatient: (id: string) => void
  onAddToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void
  onUpdatePatient: (patient: Patient) => void
  onRefreshData?: () => Promise<void>
}

export default function CapacityAssessments({ patients, onViewPatient, onAddToast, onUpdatePatient, onRefreshData }: Props) {
  const [tab, setTab] = useState(0)
  const [scheduleModal, setScheduleModal] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState('')
  const [newAssessment, setNewAssessment] = useState({ date: new Date().toISOString().split('T')[0], assessedBy: DOCTORS[0], result: 'Pass', notes: '' })

  const active = patients.filter(p => p.admissionType !== 'Discharged' && p.admissionType !== 'Minor')

  const duePatients = active.filter(p => {
    const lastAssmt = p.assessments.slice(-1)[0]
    if (!lastAssmt?.nextDue) return false
    const diff = daysBetween(lastAssmt.nextDue)
    return diff >= -7
  })

  const allAssessments = patients.flatMap(p =>
    p.assessments.map(a => ({ ...a, patientName: p.name, patientId: p.id, admissionType: p.admissionType as string }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  function daysDiffLabel(nextDue: string) {
    const diff = daysBetween(nextDue)
    if (diff > 0) return { text: `${diff}d overdue`, cls: 'text-red-600 font-semibold' }
    if (diff === 0) return { text: 'Due today', cls: 'text-amber-600 font-semibold' }
    if (diff >= -2) return { text: `In ${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''}`, cls: 'text-amber-600 font-medium' }
    return { text: `In ${Math.abs(diff)} days`, cls: 'text-green-600' }
  }

  async function handleSchedule() {
    const patient = patients.find(p => p.id === selectedPatient)
    if (!patient || !patient.activeAdmissionId) return

    const nextDue = getNextAssessmentDate(patient.admissionDate, newAssessment.date)
    const { error } = await addCapacityAssessment({
      patient_id: patient.id,
      admission_id: patient.activeAdmissionId,
      assessment_date: newAssessment.date,
      assessed_by: newAssessment.assessedBy,
      result: newAssessment.result as 'Pass' | 'Fail',
      notes: newAssessment.notes || null,
      next_assessment_due: nextDue.toISOString().split('T')[0],
    })
    if (error) {
      onAddToast('error', 'Failed to save assessment', error.message)
      return
    }

    // If Pass and patient is High Support → shift to Independent + create transfer
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
      onAddToast('success', 'Assessment saved — shifted to Independent', `For ${patient.name}`)
    } else {
      onAddToast('success', 'Assessment recorded', `For ${patient.name}`)
    }

    setScheduleModal(false)
    if (onRefreshData) await onRefreshData()
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {['Due / Upcoming', 'Completed'].map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={cn('px-4 py-1.5 text-xs font-medium rounded-md transition-colors',
                tab === i ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={() => setScheduleModal(true)}
          className="flex items-center gap-1.5 bg-[#0D6E6E] text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-[#0A5858]"
        >
          <Plus className="w-3.5 h-3.5" />
          Schedule New Assessment
        </button>
      </div>

      {tab === 0 && (
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Patient', 'Admission Type', 'Last Assessment', 'Last Result', 'Next Due', 'Days Until Due', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {duePatients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-400">
                      <p className="font-medium">No assessments due</p>
                    </td>
                  </tr>
                ) : (
                  duePatients.map((p, i) => {
                    const last = p.assessments.slice(-1)[0]
                    const label = last?.nextDue ? daysDiffLabel(last.nextDue) : null
                    return (
                      <tr key={p.id} className={cn('border-b border-slate-50 last:border-0', i % 2 === 1 ? 'bg-slate-50/50' : '')}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{p.name}</p>
                          <p className="text-slate-400 font-mono">{p.id}</p>
                        </td>
                        <td className="px-4 py-3"><AdmissionTypeBadge type={p.admissionType} /></td>
                        <td className="px-4 py-3 font-mono text-slate-600">{last ? formatDate(last.date) : '—'}</td>
                        <td className="px-4 py-3">{last ? <StatusBadge status={last.result} /> : '—'}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{last?.nextDue ? formatDate(last.nextDue) : '—'}</td>
                        <td className={cn('px-4 py-3', label?.cls ?? '')}>{label?.text ?? '—'}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => onViewPatient(p.id)} className="p-1.5 rounded text-slate-400 hover:text-[#0D6E6E] hover:bg-teal-50">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 1 && (
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Date', 'Patient', 'Type', 'Conducted By', 'Result', 'Notes'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allAssessments.map((a, i) => (
                  <tr key={a.id} className={cn('border-b border-slate-50 last:border-0', i % 2 === 1 ? 'bg-slate-50/50' : '')}>
                    <td className="px-4 py-3 font-mono text-slate-600">{formatDate(a.date)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{a.patientName}</p>
                      <p className="text-slate-400 font-mono">{a.patientId}</p>
                    </td>
                    <td className="px-4 py-3"><AdmissionTypeBadge type={a.admissionType} /></td>
                    <td className="px-4 py-3 text-slate-600">{a.conductedBy}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.result} /></td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={scheduleModal} onClose={() => setScheduleModal(false)} title="Schedule New Assessment">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Patient</label>
            <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0D6E6E]/30">
              <option value="">Select patient</option>
              {active.map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Date</label>
            <input type="date" value={newAssessment.date} onChange={e => setNewAssessment(s => ({ ...s, date: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Assessed By</label>
            <select value={newAssessment.assessedBy} onChange={e => setNewAssessment(s => ({ ...s, assessedBy: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0D6E6E]/30">
              {DOCTORS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Result</label>
            <select value={newAssessment.result} onChange={e => setNewAssessment(s => ({ ...s, result: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0D6E6E]/30">
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea rows={2} value={newAssessment.notes} onChange={e => setNewAssessment(s => ({ ...s, notes: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setScheduleModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleSchedule} disabled={!selectedPatient} className="px-4 py-2 text-sm bg-[#0D6E6E] text-white rounded-lg hover:bg-[#0A5858] disabled:opacity-50">Schedule</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
