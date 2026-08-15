'use client'
import { useState, useRef } from 'react'
import { Search, UserPlus, FileText, Check, Trash2, Phone } from 'lucide-react'
import { StatusBadge, AdmissionTypeBadge } from '@/components/ui/badge-status'
import { formatDate, type Patient } from '@/lib/data'
import { deletePatients } from '@/lib/db'
import { cn } from '@/lib/utils'

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['bg-[#007AFF]', 'bg-[#5856D6]', 'bg-[#AF52DE]', 'bg-[#FF9500]', 'bg-[#FF3B30]', 'bg-[#34C759]']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={cn('rounded-full flex items-center justify-center text-white font-semibold shrink-0', color, size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-10 h-10 text-[13px]')}>
      {initials}
    </div>
  )
}

interface Props {
  patients: Patient[]
  onViewPatient: (id: string) => void
  onNewAdmission: () => void
  onRefreshData: () => Promise<void>
  onAddToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void
}

export default function AllPatients({ patients, onViewPatient, onNewAdmission, onRefreshData, onAddToast }: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [swipedRow, setSwipedRow] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const touchStartX = useRef(0)

  async function handleDelete() {
    const ids = Array.from(selected)
    const { error } = await deletePatients(ids)
    if (error) { onAddToast('error', 'Delete failed', error.message); return }
    onAddToast('success', `${ids.length} patient${ids.length > 1 ? 's' : ''} deleted`)
    clearSelection()
    setConfirmDelete(false)
    await onRefreshData()
  }

  function exportCSV() {
    const selectedPatients = filtered.filter(p => selected.has(p.id))
    const headers = ['Patient Code', 'Name', 'Age', 'Gender', 'Type', 'Sub-Status', 'Admission Date', 'Days Admitted', 'Doctor', 'Status']
    const rows = selectedPatients.map(p => [p.patientCode, p.name, p.age, p.gender, p.admissionType, p.currentSubStatus, p.admissionDate, p.daysAdmitted, p.treatingDoctor, p.status].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `patients-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const filtered = patients.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'All' || p.admissionType === typeFilter
    const matchStatus = statusFilter === 'All' || (statusFilter === 'Active' ? p.admissionType !== 'Discharged' : p.admissionType === 'Discharged')
    return matchSearch && matchType && matchStatus
  })

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function selectAll() { setSelected(new Set(filtered.map(p => p.id))) }
  function clearSelection() { setSelected(new Set()); setBulkMode(false) }

  return (
    <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
      {/* Header row */}
      <div className="border-b border-[rgba(60,60,67,0.1)] pb-4 mb-1">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[20px] font-black text-[#000000] tracking-tight">All Patients</h1>
            <p className="text-[12px] text-[#8E8E93] mt-0.5">{filtered.length} of {patients.length} shown</p>
          </div>
          <button
            onClick={onNewAdmission}
            className="flex items-center gap-1.5 bg-[#007AFF] text-white px-4 py-2.5 rounded-xl text-[13px] font-semibold active:opacity-80 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">New Admission</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-3 top-[9px] w-[14px] h-[14px] text-[#8E8E93]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patients…"
              className="w-full pl-8 pr-3 py-2 bg-[#F2F2F7] border border-[rgba(60,60,67,0.1)] rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 placeholder-[#C7C7CC]"
            />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="bg-[#F2F2F7] border border-[rgba(60,60,67,0.1)] rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 text-[#3A3A3C]">
            {['All', 'Independent', 'High Support', 'Minor', 'Discharged'].map(o => <option key={o}>{o}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#F2F2F7] border border-[rgba(60,60,67,0.1)] rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 text-[#3A3A3C]">
            {['All', 'Active', 'Discharged'].map(o => <option key={o}>{o}</option>)}
          </select>
          {!bulkMode ? (
            <button onClick={() => setBulkMode(true)} className="px-3 py-2 bg-[#F2F2F7] border border-[rgba(60,60,67,0.1)] rounded-xl text-[13px] text-[#3A3A3C] font-medium active:bg-[#E5E5EA] shrink-0">Select</button>
          ) : (
            <div className="flex gap-2 shrink-0">
              <button onClick={selectAll} className="px-3 py-2 bg-[#F2F2F7] border border-[rgba(60,60,67,0.1)] rounded-xl text-[13px] text-[#3A3A3C] font-medium active:bg-[#E5E5EA]">All</button>
              <button onClick={clearSelection} className="px-3 py-2 bg-[#F2F2F7] border border-[rgba(60,60,67,0.1)] rounded-xl text-[13px] text-[#3A3A3C] font-medium active:bg-[#E5E5EA]">Done</button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && selected.size > 0 && (
        <div className="ios-card px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="text-[13px] text-[#000000] font-medium">{selected.size} selected</span>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCSV} className="px-3 py-1.5 bg-[#007AFF]/10 text-[#007AFF] rounded-lg text-[12px] font-medium active:opacity-70">Export CSV</button>
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF3B30]/10 text-[#FF3B30] rounded-lg text-[12px] font-medium active:opacity-70">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl p-6 mx-4 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#FF3B30]/10 mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-[#FF3B30]" />
            </div>
            <h2 className="text-[17px] font-bold text-center text-[#000000] mb-1">Delete {selected.size} Patient{selected.size > 1 ? 's' : ''}?</h2>
            <p className="text-[13px] text-[#8E8E93] text-center mb-6">All admissions, assessments, notes, transfers and notifications will be permanently deleted. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 bg-[#E5E5EA] rounded-xl text-[14px] font-medium text-[#3A3A3C] active:bg-[#D1D1D6]">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-[#FF3B30] rounded-xl text-[14px] font-medium text-white active:opacity-80">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-[rgba(60,60,67,0.12)] bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-260px)] overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#F9F9F9] border-b border-[rgba(60,60,67,0.08)]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">Patient</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide hidden md:table-cell">Age</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">Type</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide hidden lg:table-cell">Admitted</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide hidden lg:table-cell">Sub-Status</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide hidden xl:table-cell">Days</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide hidden xl:table-cell">Next Action</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-[#8E8E93]">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-8 h-8 opacity-30" />
                      <p className="font-medium">No patients found</p>
                      <p className="text-[12px]">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    className={cn(
                      'ios-separator last:[border-bottom:none] transition-all cursor-pointer hover:bg-[#F2F2F7]/50 active:bg-[#E5E5EA]/50 animate-fade-in-up',
                      selected.has(p.id) && 'bg-[#007AFF]/5'
                    )}
                    style={{ animationDelay: `${i * 30}ms`, borderBottom: '1px solid rgba(60,60,67,0.06)' }}
                    onClick={() => bulkMode ? toggleSelect(p.id) : onViewPatient(p.id)}
                    onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
                    onTouchEnd={e => {
                      const diff = e.changedTouches[0].clientX - touchStartX.current
                      if (diff < -60) setSwipedRow(p.id)
                      else if (diff > 30) setSwipedRow(null)
                    }}
                  >
                    {bulkMode && (
                      <td className="pl-5 py-3 w-10">
                        <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center',
                          selected.has(p.id) ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[#C7C7CC]'
                        )}>
                          {selected.has(p.id) && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={p.name} />
                        <div>
                          <p className="font-medium text-[#000000]">{p.name}</p>
                          <p className="text-[11px] text-[#8E8E93] font-mono">{p.patientCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[#3A3A3C] hidden md:table-cell">{p.age}</td>
                    <td className="px-5 py-3"><AdmissionTypeBadge type={p.currentSubStatus.startsWith('CHS') || p.currentSubStatus === 'HS ≤30 days' ? p.currentSubStatus : p.admissionType} /></td>
                    <td className="px-5 py-3 text-[#8E8E93] hidden lg:table-cell">{formatDate(p.admissionDate)}</td>
                    <td className="px-5 py-3 text-[#3A3A3C] hidden lg:table-cell">{p.currentSubStatus}</td>
                    <td className="px-5 py-3 text-[#3A3A3C] hidden xl:table-cell">
                      {p.admissionType === 'Discharged' ? '—' : p.daysAdmitted}
                    </td>
                    <td className="px-5 py-3 text-[#3A3A3C] hidden xl:table-cell">
                      {p.nextActionDue === '—' ? '—' : p.admissionType === 'Minor' ? `Turns 18: ${formatDate(p.nextActionDue)}` : p.nextActionType}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} tooltip={p.statusReason || undefined} /></td>
                    <td className="px-5 py-3">
                      {swipedRow === p.id && (
                        <div className="flex gap-1 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                          {p.phone && <a href={`tel:${p.phone}`} className="p-2 rounded-lg bg-[#34C759] text-white"><Phone className="w-4 h-4" /></a>}
                          <button onClick={() => onViewPatient(p.id)} className="p-2 rounded-lg bg-[#5856D6] text-white"><FileText className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-[rgba(60,60,67,0.08)] flex items-center justify-between bg-[#F9F9F9]">
          <span className="text-[13px] text-[#8E8E93]">Showing <span className="font-semibold text-[#000000]">{filtered.length}</span> of {patients.length} patients</span>
        </div>
      </div>
    </div>
  )
}
