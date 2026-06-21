'use client'
import { useState } from 'react'
import { AlertTriangle, Eye } from 'lucide-react'
import { StatusBadge, AdmissionTypeBadge } from '@/components/ui/badge-status'
import { Modal } from '@/components/ui/modal'
import { formatDate, daysBetween, daysFromNow, TODAY, type Patient } from '@/lib/data'
import { cn } from '@/lib/utils'
import { addBillingPeriod, updateSubCategory, getNextMilestoneSubCategory } from '@/lib/db'

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
  const [billingAmount, setBillingAmount] = useState('')
  const [renewNotes, setRenewNotes] = useState('')

  const renewalPatients = patients.filter(p =>
    p.admissionType !== 'Discharged' &&
    (p.nextActionType === 'Contract Renewal' || p.nextActionType === 'Shift to HS >90 days' || p.nextActionType === 'Shift to HS >30 days')
  )

  function getDaysOverdue(dueDate: string): number {
    if (dueDate === '—') return 0
    return daysBetween(dueDate)
  }

  function openRenewModal(p: Patient) {
    const lastBill = p.billingPeriods.slice(-1)[0]
    setBillingAmount(lastBill?.amount?.toString() ?? '30000')
    setRenewNotes('')
    setRenewModal(p)
  }

  async function handleRenew() {
    if (!renewModal || !renewModal.activeAdmissionId) return
    const today = TODAY.toISOString().split('T')[0]
    const endDate = daysFromNow(30)

    const { error: billError } = await addBillingPeriod({
      patient_id: renewModal.id,
      admission_id: renewModal.activeAdmissionId,
      period_label: `Period ${renewModal.billingPeriods.length + 1}`,
      from_date: today,
      to_date: endDate,
      sub_category: renewModal.currentSubStatus,
      amount: parseInt(billingAmount) || 30000,
      status: 'Pending',
    })
    if (billError) {
      onAddToast('error', 'Renewal failed', billError.message)
      return
    }

    const nextSub = getNextMilestoneSubCategory(renewModal.currentSubStatus)
    if (nextSub !== renewModal.currentSubStatus) {
      await updateSubCategory(renewModal.activeAdmissionId, nextSub)
    }

    onAddToast('success', 'Renewal completed', `${renewModal.name}'s admission renewed.`)
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
                {['ID', 'Name', 'Type', 'Sub-Category', 'Admitted', 'Due', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[#8E8E93] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renewalPatients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-[#8E8E93]">
                    No renewals due
                  </td>
                </tr>
              ) : (
                renewalPatients.map((p) => {
                  const overdueN = p.nextActionDue !== '—' ? getDaysOverdue(p.nextActionDue) : 0
                  return (
                    <tr key={p.id} className={cn(
                      'ios-separator last:[border-bottom:none]',
                      overdueN > 0 && 'bg-[#FF3B30]/4',
                      overdueN === 0 && p.nextActionDue !== '—' && 'bg-[#FF9500]/4',
                    )}>
                      <td className="px-5 py-3 font-mono text-[#8E8E93] text-[12px]">{p.id}</td>
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
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openRenewModal(p)}
                            className="px-3 py-1.5 text-[12px] bg-[#007AFF] text-white rounded-lg font-medium active:opacity-80"
                          >
                            Renew
                          </button>
                          <button
                            onClick={() => onViewPatient(p.id)}
                            className="p-2 rounded-lg text-[#8E8E93] hover:text-[#007AFF] hover:bg-[#007AFF]/8"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
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
                <span className="text-[#8E8E93]">Current Period</span>
                <span className="font-medium text-[#3A3A3C]">{renewModal.currentSubStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8E8E93]">New Period</span>
                <span className="font-medium text-[#3A3A3C]">
                  {formatDate(TODAY.toISOString().split('T')[0])} → {formatDate(daysFromNow(30))}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Amount (₹)</label>
              <input
                type="number"
                value={billingAmount}
                onChange={e => setBillingAmount(e.target.value)}
                className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30"
              />
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
