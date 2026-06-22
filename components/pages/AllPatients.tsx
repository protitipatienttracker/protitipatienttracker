'use client'
import { useState, useRef } from 'react'
import { Search, UserPlus, Eye, Pencil, ChevronLeft, ChevronRight, Phone, FileText, Check } from 'lucide-react'
import { StatusBadge, AdmissionTypeBadge } from '@/components/ui/badge-status'
import { formatDate, type Patient } from '@/lib/data'
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
}

export default function AllPatients({ patients, onViewPatient, onNewAdmission }: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [swipedRow, setSwipedRow] = useState<string | null>(null)
  const touchStartX = useRef(0)

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
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-3 top-[9px] w-[14px] h-[14px] text-[#8E8E93]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full pl-8 pr-3 py-2 bg-[#E5E5EA]/60 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 placeholder-[#8E8E93]"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-[#E5E5EA]/60 rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 text-[#3A3A3C]"
          >
            {['All', 'Independent', 'High Support', 'Minor', 'Discharged'].map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#E5E5EA]/60 rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 text-[#3A3A3C]"
          >
            {['All', 'Active', 'Discharged'].map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onNewAdmission}
            className="flex items-center gap-1.5 bg-[#007AFF] text-white px-3 sm:px-4 py-2 rounded-xl text-[13px] font-medium active:opacity-80 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">New Admission</span>
            <span className="sm:hidden">New</span>
          </button>
          {!bulkMode ? (
            <button onClick={() => setBulkMode(true)} className="px-3 py-2 bg-[#E5E5EA] rounded-xl text-[13px] text-[#3A3A3C] font-medium active:bg-[#D1D1D6] shrink-0">Select</button>
          ) : (
            <div className="flex gap-2 shrink-0">
              <button onClick={selectAll} className="px-3 py-2 bg-[#E5E5EA] rounded-xl text-[13px] text-[#3A3A3C] font-medium active:bg-[#D1D1D6]">All</button>
              <button onClick={clearSelection} className="px-3 py-2 bg-[#E5E5EA] rounded-xl text-[13px] text-[#3A3A3C] font-medium active:bg-[#D1D1D6]">Done</button>
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
            <button onClick={() => alert('Assign Doctor: Select patients and choose a doctor to bulk-assign.')} className="px-3 py-1.5 bg-[#5856D6]/10 text-[#5856D6] rounded-lg text-[12px] font-medium active:opacity-70">Assign Doctor</button>
            <button onClick={() => alert('Reminders will be sent for ' + selected.size + ' patients.')} className="px-3 py-1.5 bg-[#FF9500]/10 text-[#FF9500] rounded-lg text-[12px] font-medium active:opacity-70">Reminder</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="ios-card overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#F2F2F7]">
                <th className="text-left px-5 py-3 text-[#8E8E93] font-medium">Patient</th>
                <th className="text-left px-5 py-3 text-[#8E8E93] font-medium">ID</th>
                <th className="text-left px-5 py-3 text-[#8E8E93] font-medium hidden md:table-cell">Age</th>
                <th className="text-left px-5 py-3 text-[#8E8E93] font-medium">Type</th>
                <th className="text-left px-5 py-3 text-[#8E8E93] font-medium hidden lg:table-cell">Admitted</th>
                <th className="text-left px-5 py-3 text-[#8E8E93] font-medium hidden lg:table-cell">Sub-Status</th>
                <th className="text-left px-5 py-3 text-[#8E8E93] font-medium hidden xl:table-cell">Days</th>
                <th className="text-left px-5 py-3 text-[#8E8E93] font-medium hidden xl:table-cell">Next Action</th>
                <th className="text-left px-5 py-3 text-[#8E8E93] font-medium">Status</th>
                <th className="text-left px-5 py-3 text-[#8E8E93] font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-[#8E8E93]">
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
                    style={{ animationDelay: `${i * 30}ms` }}
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
                        <span className="font-medium text-[#000000]">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-[#8E8E93] text-[12px]">{p.id}</td>
                    <td className="px-5 py-3 text-[#3A3A3C] hidden md:table-cell">{p.age}</td>
                    <td className="px-5 py-3"><AdmissionTypeBadge type={p.admissionType} /></td>
                    <td className="px-5 py-3 text-[#8E8E93] hidden lg:table-cell">{formatDate(p.admissionDate)}</td>
                    <td className="px-5 py-3 text-[#3A3A3C] hidden lg:table-cell">{p.currentSubStatus}</td>
                    <td className="px-5 py-3 text-[#3A3A3C] hidden xl:table-cell">
                      {p.admissionType === 'Discharged' ? '—' : p.daysAdmitted}
                    </td>
                    <td className="px-5 py-3 text-[#3A3A3C] hidden xl:table-cell">
                      {p.nextActionDue === '—' ? '—' : p.nextActionType}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-3 relative">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {swipedRow === p.id ? (
                          <div className="flex gap-1 animate-fade-in-up">
                            <button onClick={() => onViewPatient(p.id)} className="p-2 rounded-lg bg-[#007AFF] text-white"><Eye className="w-4 h-4" /></button>
                            {p.phone && <a href={`tel:${p.phone}`} className="p-2 rounded-lg bg-[#34C759] text-white"><Phone className="w-4 h-4" /></a>}
                            <button onClick={() => onViewPatient(p.id)} className="p-2 rounded-lg bg-[#5856D6] text-white"><FileText className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => onViewPatient(p.id)} className="p-2 rounded-lg text-[#8E8E93] hover:text-[#007AFF] hover:bg-[#007AFF]/8 transition-colors"><Eye className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 ios-separator flex items-center justify-between bg-[#F2F2F7]/40">
          <span className="text-[13px] text-[#8E8E93]">Showing {filtered.length} of {patients.length}</span>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-lg text-[#8E8E93] hover:bg-[#E5E5EA] disabled:opacity-30" disabled>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[12px] px-2.5 py-1 rounded-lg bg-[#007AFF] text-white font-medium">1</span>
            <button className="p-1.5 rounded-lg text-[#8E8E93] hover:bg-[#E5E5EA] disabled:opacity-30" disabled>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
