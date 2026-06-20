'use client'
import { useState } from 'react'
import { Search, RefreshCw, AlertTriangle } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge-status'
import { Modal } from '@/components/ui/modal'
import { formatDate, daysBetween, type Patient } from '@/lib/data'
import { cn } from '@/lib/utils'

interface Props {
  patients: Patient[]
  onViewPatient: (id: string) => void
  onReadmit: (patient: Patient) => void
  onAddToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void
}

export default function Discharged({ patients, onViewPatient, onReadmit, onAddToast }: Props) {
  const [search, setSearch] = useState('')
  const [reasonFilter, setReasonFilter] = useState('All')
  const [confirmPatient, setConfirmPatient] = useState<Patient | null>(null)

  const discharged = patients.filter(p =>
    p.admissionType === 'Discharged' &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase())) &&
    (reasonFilter === 'All' || p.dischargeReason === reasonFilter)
  )

  function checkReadmit(p: Patient) {
    setConfirmPatient(p)
  }

  function handleReadmit() {
    if (!confirmPatient) return
    onReadmit(confirmPatient)
    setConfirmPatient(null)
  }

  function daysSinceDischarge(p: Patient) {
    if (!p.dischargeDate) return null
    return daysBetween(p.dischargeDate)
  }

  const isRecentDischarge = (p: Patient) => {
    const days = daysSinceDischarge(p)
    return days !== null && days <= 7
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30 bg-white w-48" />
          </div>
          <select value={reasonFilter} onChange={e => setReasonFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0D6E6E]/30 text-slate-700">
            {['All', 'Capacity Regained', 'Voluntary', 'Clinical Decision'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <span className="text-sm text-slate-500">{discharged.length} discharged patient{discharged.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Patient ID', 'Name', 'Discharge Type', 'Discharge Date', 'Total Stay', 'Reason', 'Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {discharged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-8 h-8 opacity-30" />
                      <p className="font-medium">No discharged patients found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                discharged.map((p, i) => (
                  <tr key={p.id} className={cn('border-b border-slate-50 last:border-0', i % 2 === 1 ? 'bg-slate-50/50' : '')}>
                    <td className="px-4 py-3 font-mono text-slate-500">{p.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                        {p.admissionHistory.slice(-2, -1)[0]?.type || 'High Support'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{p.dischargeDate ? formatDate(p.dischargeDate) : '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.totalStay || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', {
                        'bg-green-100 text-green-700': p.dischargeReason === 'Capacity Regained',
                        'bg-blue-100 text-blue-700': p.dischargeReason === 'Voluntary',
                        'bg-slate-100 text-slate-600': p.dischargeReason === 'Clinical Decision',
                      })}>
                        {p.dischargeReason}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => checkReadmit(p)}
                        className="flex items-center gap-1 text-xs text-[#0D6E6E] hover:text-[#0A5858] font-medium hover:underline"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Readmit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!confirmPatient} onClose={() => setConfirmPatient(null)} title="Confirm Readmission" size="sm">
        {confirmPatient && (
          <div className="space-y-4">
            {isRecentDischarge(confirmPatient) && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  <strong>Warning:</strong> {confirmPatient.name} was discharged {daysSinceDischarge(confirmPatient)} days ago.
                  They will resume their previous High Support sub-category as per admission rules.
                </p>
              </div>
            )}
            <p className="text-sm text-slate-700">
              Readmit <strong>{confirmPatient.name}</strong>? This will open the New Admission form pre-filled with their details.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmPatient(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleReadmit} className="px-4 py-2 text-sm bg-[#0D6E6E] text-white rounded-lg hover:bg-[#0A5858] font-medium">Proceed to Readmit</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
