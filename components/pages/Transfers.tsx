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
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-700">Transfer Records ({transfers.length})</h2>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-1.5 bg-[#0D6E6E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0A5858]"
        >
          <Plus className="w-3.5 h-3.5" />
          Record Manual Transfer
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Date', 'Patient', 'From', 'To', 'Reason', 'Triggered By', 'Notes'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transfers.map((t, i) => (
                <tr key={t.id} className={cn('border-b border-slate-50 last:border-0', i % 2 === 1 ? 'bg-slate-50/50' : '')}>
                  <td className="px-4 py-3 font-mono text-slate-500">{formatDate(t.date)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{t.patientName}</p>
                    <p className="font-mono text-slate-400">{t.patientId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">{t.fromType}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">{t.toType}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.reason}</td>
                  <td className="px-4 py-3 text-slate-600">{t.triggeredBy}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{t.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Record Manual Transfer">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Patient</label>
            <select value={form.patientId} onChange={e => setForm(s => ({ ...s, patientId: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0D6E6E]/30">
              <option value="">Select patient</option>
              {patients.filter(p => p.admissionType !== 'Discharged').map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">From Type</label>
              <select value={form.fromType} onChange={e => setForm(s => ({ ...s, fromType: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0D6E6E]/30">
                <option value="">Select</option>
                {subTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">To Type</label>
              <select value={form.toType} onChange={e => setForm(s => ({ ...s, toType: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0D6E6E]/30">
                <option value="">Select</option>
                {subTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason</label>
            <input value={form.reason} onChange={e => setForm(s => ({ ...s, reason: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30"
              placeholder="Reason for transfer" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Triggered By</label>
            <input value={form.triggeredBy} onChange={e => setForm(s => ({ ...s, triggeredBy: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleSubmit} className="px-4 py-2 text-sm bg-[#0D6E6E] text-white rounded-lg hover:bg-[#0A5858]">Save Transfer</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
