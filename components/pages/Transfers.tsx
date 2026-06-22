'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { formatDate, type Transfer, type Patient } from '@/lib/data'
import { cn } from '@/lib/utils'
import { insertTransfer } from '@/lib/db'

const subTypes = ['HS ≤30 days', 'HS >30 days', 'HS >90 days', 'HS >120 days', 'HS >180 days', 'Independent', 'Minor']

interface Props {
  transfers: Transfer[]
  patients: Patient[]
  onAddTransfer: (t: Transfer) => void
  onAddToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void
  onRefreshData?: () => Promise<void>
}

export default function Transfers({ transfers, patients, onAddTransfer, onAddToast, onRefreshData }: Props) {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ patientId: '', fromType: '', toType: '', reason: '', triggeredBy: 'Arjun Sathe', notes: '' })

  async function handleSubmit() {
    const patient = patients.find(p => p.id === form.patientId)
    if (!patient || !form.fromType || !form.toType || !form.reason) return

    const { error } = await insertTransfer({
      patient_id: patient.id,
      from_admission_id: patient.activeAdmissionId ?? null,
      to_admission_id: patient.activeAdmissionId ?? null,
      transfer_date: new Date().toISOString().split('T')[0],
      from_type: form.fromType,
      to_type: form.toType,
      reason: form.reason,
      triggered_by: form.triggeredBy,
      notes: form.notes || null,
    })
    if (error) {
      onAddToast('error', 'Failed to save transfer', error.message)
      return
    }

    onAddToast('success', 'Transfer recorded', `${patient.name}: ${form.fromType} → ${form.toType}`)
    setModal(false)
    setForm({ patientId: '', fromType: '', toType: '', reason: '', triggeredBy: 'Arjun Sathe', notes: '' })
    if (onRefreshData) await onRefreshData()
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-[#000000]">Transfers ({transfers.length})</h2>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-1.5 bg-[#007AFF] text-white px-4 py-2.5 rounded-xl text-[13px] font-medium active:opacity-80"
        >
          <Plus className="w-3.5 h-3.5" />
          Record Transfer
        </button>
      </div>

      <div className="ios-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#F2F2F7]/60">
                {['Date', 'Patient', 'From', 'To', 'Reason', 'By', 'Notes'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[#8E8E93] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-[#8E8E93]">No transfers recorded</td>
                </tr>
              ) : (
                transfers.map((t) => (
                  <tr key={t.id} className="ios-separator last:[border-bottom:none]">
                    <td className="px-5 py-3 text-[#8E8E93]">{formatDate(t.date)}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-[#000000]">{t.patientName}</p>
                      <p className="font-mono text-[#8E8E93] text-[11px]">{t.patientId}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#8E8E93]/12 text-[#8E8E93]">{t.fromType}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#007AFF]/12 text-[#007AFF]">{t.toType}</span>
                    </td>
                    <td className="px-5 py-3 text-[#3A3A3C]">{t.reason}</td>
                    <td className="px-5 py-3 text-[#3A3A3C]">{t.triggeredBy}</td>
                    <td className="px-5 py-3 text-[#8E8E93] max-w-xs truncate">{t.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Record Transfer">
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Patient</label>
            <select value={form.patientId} onChange={e => setForm(s => ({ ...s, patientId: e.target.value }))}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
              <option value="">Select patient</option>
              {patients.filter(p => p.admissionType !== 'Discharged').map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">From</label>
              <select value={form.fromType} onChange={e => setForm(s => ({ ...s, fromType: e.target.value }))}
                className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
                <option value="">Select</option>
                {subTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">To</label>
              <select value={form.toType} onChange={e => setForm(s => ({ ...s, toType: e.target.value }))}
                className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
                <option value="">Select</option>
                {subTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Reason</label>
            <input value={form.reason} onChange={e => setForm(s => ({ ...s, reason: e.target.value }))}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30"
              placeholder="Reason for transfer" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Triggered By</label>
            <input value={form.triggeredBy} onChange={e => setForm(s => ({ ...s, triggeredBy: e.target.value }))}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] resize-none outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModal(false)} className="px-5 py-2.5 text-[14px] bg-[#E5E5EA] rounded-xl active:bg-[#D1D1D6]">Cancel</button>
            <button onClick={handleSubmit} className="px-5 py-2.5 text-[14px] bg-[#007AFF] text-white rounded-xl font-medium active:opacity-80">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
