'use client'
import { useState } from 'react'
import { AlertTriangle, Eye } from 'lucide-react'
import { StatusBadge, AdmissionTypeBadge } from '@/components/ui/badge-status'
import { Modal } from '@/components/ui/modal'
import { formatDate, daysBetween, type Patient } from '@/lib/data'
import { cn } from '@/lib/utils'
import { updateSubCategory, getNextMilestoneSubCategory, addClinicalNote } from '@/lib/db'

interface Props {
  patients: Patient[]
  onViewPatient: (id: string) => void
  onAddToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void
  onUpdatePatient: (patient: Patient) => void
  onRefreshData?: () => Promise<void>
}

export default function RenewalsDue({ patients, onViewPatient, onAddToast, onUpdatePatient, onRefreshData }: Props) {
  const [dateFilter, setDateFilter] = useState('This Week')
  const [renewModal, setRenewModal] = useState<Patient | null>(null)
  const [renewNotes, setRenewNotes] = useState('')

  const renewalPatients = patients.filter(p =>
    p.admissionType !== 'Discharged' &&
    (p.nextActionType === 'Shift to CHS' || p.nextActionType === 'CHS Renewal')
  )

  function getDaysOverdue(dueDate: string): number {
    if (dueDate === '—') return 0
    return daysBetween(dueDate)
  }

  async function handleRenew() {
    if (!renewModal || !renewModal.activeAdmissionId) return
    const nextSub = getNextMilestoneSubCategory(renewModal.currentSubStatus)
    if (nextSub !== renewModal.currentSubStatus) {
      await updateSubCategory(renewModal.activeAdmissionId, nextSub)
    }
    if (renewNotes.trim()) {
      await addClinicalNote({
        patient_id: renewModal.id,
        admission_id: renewModal.activeAdmissionId,
        note_date: new Date().toISOString().split('T')[0],
        author: 'Staff',
        note_type: 'Clinical',
        content: `Renewal to ${nextSub}: ${renewNotes.trim()}`,
      })
    }
    onAddToast('success', 'Renewal completed', `${renewModal.name} moved to ${nextSub}.`)
    setRenewModal(null)
    if (onRefreshData) await onRefreshData()
  }

  const overdue = renewalPatients.filter(p => p.nextActionDue !== '—' && getDaysOverdue(p.nextActionDue) > 0)

  return (
    <div className="p-5 sm:p-6 space-y-4">
      {overdue.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-[#FF9500]/10 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-[#FF9500] shrink-0" />
          <p className="text-[14px] text-[#FF9500] font-medium">
            {overdue.length} renewal{overdue.length > 1 ? 's' : ''} overdue
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-[#000000]">Renewals ({renewalPatients.length})</h2>
        <div className="flex gap-1.5">
          {['This Week', 'This Month', 'All'].map(f => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors',
                dateFilter === f ? 'bg-[#007AFF] text-white' : 'bg-[#E5E5EA] text-[#3A3A3C] active:bg-[#D1D1D6]'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="ios-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#F2F2F7]/60">
                {['Name', 'Type', 'Sub-Category', 'Admitted', 'Due', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[#8E8E93] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renewalPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-[#8E8E93]">No renewals due</td>
                </tr>
              ) : (
                renewalPatients.map((p) => {
                  const overdueN = p.nextActionDue !== '—' ? getDaysOverdue(p.nextActionDue) : 0
                  return (
                    <tr key={p.id} className={cn(
                      'ios-separator last:[border-bottom:none] cursor-pointer hover:bg-[#F2F2F7]/50',
                      overdueN > 0 && 'bg-[#FF3B30]/4',
                      overdueN === 0 && p.nextActionDue !== '—' && 'bg-[#FF9500]/4',
                    )} onClick={() => onViewPatient(p.id)}>
                      <td className="px-5 py-3 font-medium text-[#000000]">{p.name}</td>
                      <td className="px-5 py-3"><AdmissionTypeBadge type={p.admissionType} /></td>
                      <td className="px-5 py-3 text-[#3A3A3C]">{p.currentSubStatus}</td>
                      <td className="px-5 py-3 text-[#8E8E93]">{formatDate(p.admissionDate)}</td>
                      <td className="px-5 py-3 text-[#3A3A3C]">{p.nextActionDue !== '—' ? formatDate(p.nextActionDue) : '—'}</td>
                      <td className="px-5 py-3">
                        {overdueN > 0 ? (
                          <span className="font-semibold text-[#FF3B30]">{overdueN}d overdue</span>
                        ) : overdueN === 0 ? (
                          <span className="font-semibold text-[#FF9500]">Today</span>
                        ) : (
                          <span className="text-[#3A3A3C]">{Math.abs(overdueN)}d left</span>
                        )}
                      </td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { setRenewNotes(''); setRenewModal(p) }}
                          className="px-3 py-1.5 text-[12px] bg-[#007AFF] text-white rounded-lg font-medium active:opacity-80"
                        >
                          Renew
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

      <Modal open={!!renewModal} onClose={() => setRenewModal(null)} title="Confirm Renewal">
        {renewModal && (
          <div className="space-y-4">
            <div className="bg-[#F2F2F7] rounded-2xl p-4 space-y-2.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#8E8E93]">Patient</span>
                <span className="font-semibold text-[#000000]">{renewModal.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8E8E93]">Current</span>
                <span className="font-medium text-[#3A3A3C]">{renewModal.currentSubStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8E8E93]">Moves to</span>
                <span className="font-medium text-[#007AFF]">{getNextMilestoneSubCategory(renewModal.currentSubStatus)}</span>
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Notes (optional)</label>
              <textarea rows={2} value={renewNotes} onChange={e => setRenewNotes(e.target.value)}
                className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] resize-none outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenewModal(null)} className="px-5 py-2.5 text-[14px] bg-[#E5E5EA] rounded-xl active:bg-[#D1D1D6]">Cancel</button>
              <button onClick={handleRenew} className="px-5 py-2.5 text-[14px] bg-[#007AFF] text-white rounded-xl font-medium active:opacity-80">Confirm</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
