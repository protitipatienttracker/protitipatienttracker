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
    if (diff > 0) return { text: `${diff}d overdue`, cls: 'text-[#FF3B30] font-semibold' }
    if (diff === 0) return { text: 'Due today', cls: 'text-[#FF9500] font-semibold' }
    if (diff >= -2) return { text: `In ${Math.abs(diff)}d`, cls: 'text-[#FF9500] font-medium' }
    return { text: `In ${Math.abs(diff)}d`, cls: 'text-[#34C759]' }
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
      onAddToast('success', 'Shifted to Independent', `${patient.name}`)
    } else {
      onAddToast('success', 'Assessment recorded', `${patient.name}`)
    }

    setScheduleModal(false)
    if (onRefreshData) await onRefreshData()
  }

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5 bg-[#E5E5EA] p-0.5 rounded-xl">
          {['Due / Upcoming', 'Completed'].map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={cn('px-4 py-2 text-[13px] font-medium rounded-[10px] transition-colors',
                tab === i ? 'bg-white text-[#000000] shadow-sm' : 'text-[#8E8E93]'
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={() => setScheduleModal(true)}
          className="flex items-center gap-1.5 bg-[#007AFF] text-white px-4 py-2.5 rounded-xl text-[13px] font-medium active:opacity-80"
        >
          <Plus className="w-3.5 h-3.5" />
          New Assessment
        </button>
      </div>

      {tab === 0 && (
        <div className="ios-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F2F2F7]/60">
                  {['Patient', 'Type', 'Last Assessment', 'Result', 'Next Due', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[#8E8E93] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {duePatients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-[#8E8E93]">No assessments due</td>
                  </tr>
                ) : (
                  duePatients.map((p) => {
                    const last = p.assessments.slice(-1)[0]
                    const label = last?.nextDue ? daysDiffLabel(last.nextDue) : null
                    return (
                      <tr key={p.id} className="ios-separator last:[border-bottom:none]">
                        <td className="px-5 py-3">
                          <p className="font-medium text-[#000000]">{p.name}</p>
                          <p className="text-[#8E8E93] font-mono text-[11px]">{p.id}</p>
                        </td>
                        <td className="px-5 py-3"><AdmissionTypeBadge type={p.admissionType} /></td>
                        <td className="px-5 py-3 text-[#3A3A3C]">{last ? formatDate(last.date) : '—'}</td>
                        <td className="px-5 py-3">{last ? <StatusBadge status={last.result} /> : '—'}</td>
                        <td className="px-5 py-3 text-[#3A3A3C]">{last?.nextDue ? formatDate(last.nextDue) : '—'}</td>
                        <td className={cn('px-5 py-3', label?.cls ?? '')}>{label?.text ?? '—'}</td>
                        <td className="px-5 py-3">
                          <button onClick={() => onViewPatient(p.id)} className="p-2 rounded-lg text-[#8E8E93] hover:text-[#007AFF] hover:bg-[#007AFF]/8">
                            <Eye className="w-4 h-4" />
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
        <div className="ios-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F2F2F7]/60">
                  {['Date', 'Patient', 'Type', 'By', 'Result', 'Notes'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[#8E8E93] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allAssessments.map((a) => (
                  <tr key={a.id} className="ios-separator last:[border-bottom:none]">
                    <td className="px-5 py-3 text-[#3A3A3C]">{formatDate(a.date)}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-[#000000]">{a.patientName}</p>
                      <p className="text-[#8E8E93] font-mono text-[11px]">{a.patientId}</p>
                    </td>
                    <td className="px-5 py-3"><AdmissionTypeBadge type={a.admissionType} /></td>
                    <td className="px-5 py-3 text-[#3A3A3C]">{a.conductedBy}</td>
                    <td className="px-5 py-3"><StatusBadge status={a.result} /></td>
                    <td className="px-5 py-3 text-[#8E8E93] max-w-xs truncate">{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={scheduleModal} onClose={() => setScheduleModal(false)} title="New Assessment">
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Patient</label>
            <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
              <option value="">Select patient</option>
              {active.map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Date</label>
            <input type="date" value={newAssessment.date} onChange={e => setNewAssessment(s => ({ ...s, date: e.target.value }))}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Assessed By</label>
            <select value={newAssessment.assessedBy} onChange={e => setNewAssessment(s => ({ ...s, assessedBy: e.target.value }))}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
              {DOCTORS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Result</label>
            <select value={newAssessment.result} onChange={e => setNewAssessment(s => ({ ...s, result: e.target.value }))}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Notes</label>
            <textarea rows={2} value={newAssessment.notes} onChange={e => setNewAssessment(s => ({ ...s, notes: e.target.value }))}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] resize-none outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setScheduleModal(false)} className="px-5 py-2.5 text-[14px] bg-[#E5E5EA] rounded-xl active:bg-[#D1D1D6]">Cancel</button>
            <button onClick={handleSchedule} disabled={!selectedPatient} className="px-5 py-2.5 text-[14px] bg-[#007AFF] text-white rounded-xl font-medium active:opacity-80 disabled:opacity-40">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
