'use client'
import { useState } from 'react'
import { Search, UserPlus, Eye, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { StatusBadge, AdmissionTypeBadge } from '@/components/ui/badge-status'
import { formatDate, type Patient } from '@/lib/data'
import { cn } from '@/lib/utils'

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={cn('rounded-full flex items-center justify-center text-white font-semibold shrink-0', color, size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm')}>
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

  const filtered = patients.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'All' || p.admissionType === typeFilter
    const matchStatus = statusFilter === 'All' || (statusFilter === 'Active' ? p.admissionType !== 'Discharged' : p.admissionType === 'Discharged')
    return matchSearch && matchType && matchStatus
  })

  return (
    <div className="p-6 space-y-4">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or ID..."
              className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30 bg-white w-60"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0D6E6E]/30 text-slate-700"
          >
            {['All', 'Independent', 'High Support', 'Minor', 'Discharged'].map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0D6E6E]/30 text-slate-700"
          >
            {['All', 'Active', 'Discharged'].map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <button
          onClick={onNewAdmission}
          className="flex items-center gap-2 bg-[#0D6E6E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0A5858] transition-colors shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          New Admission
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Patient</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">ID</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide hidden md:table-cell">Age</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">Admission Date</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">Sub-Status</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide hidden xl:table-cell">Days</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide hidden xl:table-cell">Next Action</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-8 h-8 opacity-30" />
                      <p className="font-medium">No patients found</p>
                      <p className="text-xs">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    className={cn(
                      'border-b border-slate-50 last:border-0 transition-colors cursor-pointer',
                      i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white',
                      'hover:bg-teal-50/30'
                    )}
                    onClick={() => onViewPatient(p.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={p.name} />
                        <span className="font-medium text-slate-800">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{p.id}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{p.age}</td>
                    <td className="px-4 py-3"><AdmissionTypeBadge type={p.admissionType} /></td>
                    <td className="px-4 py-3 font-mono text-slate-500 hidden lg:table-cell">{formatDate(p.admissionDate)}</td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{p.currentSubStatus}</td>
                    <td className="px-4 py-3 font-mono text-slate-600 hidden xl:table-cell">
                      {p.admissionType === 'Discharged' ? '—' : p.daysAdmitted}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden xl:table-cell">
                      {p.nextActionDue === '—' ? '—' : p.nextActionType}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => onViewPatient(p.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-[#0D6E6E] hover:bg-teal-50 transition-colors"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onViewPatient(p.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-sm text-slate-500">Showing {filtered.length} of {patients.length} patients</span>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-40" disabled>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs px-2 py-1 rounded bg-[#0D6E6E] text-white font-medium">1</span>
            <button className="p-1.5 rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-40" disabled>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
