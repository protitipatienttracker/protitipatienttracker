'use client'
import { cn } from '@/lib/utils'
import type { PatientStatus } from '@/lib/data'

const statusConfig: Record<string, { label: string; className: string }> = {
  'Action Needed': { label: 'Action Needed', className: 'bg-red-100 text-red-700 border border-red-200' },
  'Due Soon': { label: 'Due Soon', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  'On Track': { label: 'On Track', className: 'bg-green-100 text-green-700 border border-green-200' },
  'Upcoming': { label: 'Upcoming', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  'Discharged': { label: 'Discharged', className: 'bg-slate-100 text-slate-600 border border-slate-200' },
  'Independent': { label: 'Independent', className: 'bg-teal-100 text-teal-700 border border-teal-200' },
  'High Support': { label: 'High Support', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  'Minor': { label: 'Minor', className: 'bg-purple-100 text-purple-700 border border-purple-200' },
  'Pass': { label: 'Pass', className: 'bg-green-100 text-green-700 border border-green-200' },
  'Fail': { label: 'Fail', className: 'bg-red-100 text-red-700 border border-red-200' },
  'Paid': { label: 'Paid', className: 'bg-green-100 text-green-700 border border-green-200' },
  'Pending': { label: 'Pending', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-slate-100 text-slate-600 border border-slate-200' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  )
}

export function AdmissionTypeBadge({ type }: { type: string }) {
  const config = statusConfig[type] ?? { label: type, className: 'bg-slate-100 text-slate-600 border border-slate-200' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}
