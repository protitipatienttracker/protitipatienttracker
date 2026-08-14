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

  function daysSinceDischarge(p: Patient) {
    if (!p.dischargeDate) return null
    return daysBetween(p.dischargeDate)
  }

  const isRecentDischarge = (p: Patient) => {
    const days = daysSinceDischarge(p)
    return days !== null && days <= 7
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="border-b border-[rgba(60,60,67,0.1)] pb-4">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div>
            <h1 className="text-[20px] font-black text-[#000000] tracking-tight">Discharged</h1>
            <p className="text-[12px] text-[#8E8E93] mt-0.5">{discharged.length} patients</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-[9px] w-[14px] h-[14px] text-[#8E8E93]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search"
                className="pl-8 pr-3 py-2 bg-[#F2F2F7] border border-[rgba(60,60,67,0.1)] rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 w-full sm:w-48 placeholder-[#C7C7CC]" />
            </div>
            <select value={reasonFilter} onChange={e => setReasonFilter(e.target.value)}
              className="bg-[#F2F2F7] border border-[rgba(60,60,67,0.1)] rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 text-[#3A3A3C]">
              {['All', 'Capacity Regained', 'Voluntary', 'Clinical Decision'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[rgba(60,60,67,0.12)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-[rgba(60,60,67,0.08)]">
                {['Name', 'Prior Type', 'Discharged', 'Stay', 'Reason', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {discharged.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16">
                  <p className="text-[15px] font-bold text-[#3A3A3C]">No discharged patients</p>
                  <p className="text-[13px] text-[#8E8E93] mt-1">Discharged patients will appear here</p>
                </td></tr>
              ) : discharged.map((p) => (
                <tr key={p.id} className="border-b border-[rgba(60,60,67,0.06)] last:border-0">
                  <td className="px-5 py-3.5 font-semibold text-[#000000]">{p.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#8E8E93]/12 text-[#8E8E93]">
                      {p.admissionHistory.slice(-2, -1)[0]?.type || 'High Support'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#3A3A3C]">{p.dischargeDate ? formatDate(p.dischargeDate) : '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className="font-bold text-[#000000]">{p.totalStay || '—'}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold', {
                      'bg-[#34C759]/12 text-[#34C759]': p.dischargeReason === 'Capacity Regained',
                      'bg-[#007AFF]/12 text-[#007AFF]': p.dischargeReason === 'Voluntary',
                      'bg-[#8E8E93]/12 text-[#8E8E93]': p.dischargeReason === 'Clinical Decision',
                    })}>{p.dischargeReason}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => setConfirmPatient(p)}
                      className="flex items-center gap-1.5 text-[13px] text-[#007AFF] font-semibold active:opacity-60">
                      <RefreshCw className="w-3.5 h-3.5" /> Readmit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!confirmPatient} onClose={() => setConfirmPatient(null)} title="Confirm Readmission" size="sm">
        {confirmPatient && (
          <div className="space-y-4">
            {isRecentDischarge(confirmPatient) && (
              <div className="flex items-start gap-2.5 p-4 bg-[#FF9500]/10 rounded-2xl">
                <AlertTriangle className="w-4 h-4 text-[#FF9500] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[#FF9500]">
                  {confirmPatient.name} was discharged {daysSinceDischarge(confirmPatient)} days ago.
                </p>
              </div>
            )}
            <p className="text-[14px] text-[#3A3A3C]">
              Readmit <strong>{confirmPatient.name}</strong>? This opens a pre-filled admission form.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmPatient(null)} className="px-5 py-2.5 text-[14px] bg-[#E5E5EA] rounded-xl active:bg-[#D1D1D6]">Cancel</button>
              <button onClick={() => { onReadmit(confirmPatient); setConfirmPatient(null) }} className="px-5 py-2.5 text-[14px] bg-[#007AFF] text-white rounded-xl font-medium active:opacity-80">Readmit</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
