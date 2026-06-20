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

  function getRowBg(p: Patient): string {
    const overdue = p.nextActionDue !== '—' && getDaysOverdue(p.nextActionDue) > 0
    const today = p.nextActionDue !== '—' && getDaysOverdue(p.nextActionDue) === 0
    if (overdue) return 'bg-red-50/70'
    if (today) return 'bg-amber-50/70'
    return ''
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

    // Advance sub-category to next milestone
    const nextSub = getNextMilestoneSubCategory(renewModal.currentSubStatus)
    if (nextSub !== renewModal.currentSubStatus) {
      await updateSubCategory(renewModal.activeAdmissionId, nextSub)
    }

    onAddToast('success', 'Renewal completed', `${renewModal.name}'s admission has been renewed.`)
    setRenewModal(null)
    if (onRefreshData) await onRefreshData()
  }

  const overdue = renewalPatients.filter(p => p.nextActionDue !== '—' && getDaysOverdue(p.nextActionDue) > 0)

  return (
    <div className="p-6 space-y-4">
      {/* Alert banner */}
      {overdue.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {overdue.length} renewal{overdue.length > 1 ? 's are' : ' is'} overdue. Please take action immediately.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-700">Renewals ({renewalPatients.length})</h2>
        <div className="flex gap-2">
          {['This Week', 'This Month', 'All'].map(f => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                dateFilter === f ? 'bg-[#0D6E6E] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Patient ID', 'Name', 'Type', 'Sub-Category', 'Admission Date', 'Renewal Due', 'Overdue / Remaining', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renewalPatients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <p className="font-medium">No renewals due</p>
                    </div>
                  </td>
                </tr>
              ) : (
                renewalPatients.map((p, i) => {
                  const overdueN = p.nextActionDue !== '—' ? getDaysOverdue(p.nextActionDue) : 0
                  return (
                    <tr key={p.id} className={cn('border-b border-slate-50 last:border-0', getRowBg(p))}>
                      <td className="px-4 py-3 font-mono text-slate-500">{p.id}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-3"><AdmissionTypeBadge type={p.admissionType} /></td>
                      <td className="px-4 py-3 text-slate-600">{p.currentSubStatus}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{formatDate(p.admissionDate)}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{p.nextActionDue !== '—' ? formatDate(p.nextActionDue) : '—'}</td>
                      <td className="px-4 py-3">
                        {overdueN > 0 ? (
                          <span className="font-semibold text-red-600">{overdueN} day{overdueN !== 1 ? 's' : ''} overdue</span>
                        ) : overdueN === 0 ? (
                          <span className="font-semibold text-amber-600">Due today</span>
                        ) : (
                          <span className="text-slate-600">{Math.abs(overdueN)} days remaining</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openRenewModal(p)}
                            className="px-2.5 py-1.5 text-xs bg-[#0D6E6E] text-white rounded-lg hover:bg-[#0A5858] font-medium"
                          >
                            Renew
                          </button>
                          <button
                            onClick={() => onViewPatient(p.id)}
                            className="p-1.5 rounded text-slate-400 hover:text-[#0D6E6E] hover:bg-teal-50"
                          >
                            <Eye className="w-3.5 h-3.5" />
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

      {/* Renew Modal */}
      <Modal open={!!renewModal} onClose={() => setRenewModal(null)} title="Confirm Renewal">
        {renewModal && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Patient</span>
                <span className="font-semibold text-slate-800">{renewModal.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Period</span>
                <span className="font-medium text-slate-700">{renewModal.currentSubStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">New Period</span>
                <span className="font-medium text-slate-700">
                  {formatDate(TODAY.toISOString().split('T')[0])} → {formatDate(daysFromNow(30))}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Billing Amount (₹)</label>
              <input
                type="number"
                value={billingAmount}
                onChange={e => setBillingAmount(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Notes (optional)</label>
              <textarea rows={2} value={renewNotes} onChange={e => setRenewNotes(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenewModal(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleRenew} className="px-4 py-2 text-sm bg-[#0D6E6E] text-white rounded-lg hover:bg-[#0A5858] font-medium">Confirm Renewal</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
