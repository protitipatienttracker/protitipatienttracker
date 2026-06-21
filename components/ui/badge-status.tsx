'use client'
import { cn } from '@/lib/utils'
import type { PatientStatus } from '@/lib/data'

const statusConfig: Record<string, { label: string; className: string }> = {
  'Action Needed': { label: 'Action Needed', className: 'bg-[#FF3B30]/12 text-[#FF3B30]' },
  'Due Soon': { label: 'Due Soon', className: 'bg-[#FF9500]/12 text-[#FF9500]' },
  'On Track': { label: 'On Track', className: 'bg-[#34C759]/12 text-[#34C759]' },
  'Upcoming': { label: 'Upcoming', className: 'bg-[#FF9500]/12 text-[#FF9500]' },
  'Discharged': { label: 'Discharged', className: 'bg-[#8E8E93]/12 text-[#8E8E93]' },
  'Independent': { label: 'Independent', className: 'bg-[#007AFF]/12 text-[#007AFF]' },
  'High Support': { label: 'High Support', className: 'bg-[#FF9500]/12 text-[#FF9500]' },
  'Minor': { label: 'Minor', className: 'bg-[#AF52DE]/12 text-[#AF52DE]' },
  'Pass': { label: 'Pass', className: 'bg-[#34C759]/12 text-[#34C759]' },
  'Fail': { label: 'Fail', className: 'bg-[#FF3B30]/12 text-[#FF3B30]' },
  'Paid': { label: 'Paid', className: 'bg-[#34C759]/12 text-[#34C759]' },
  'Pending': { label: 'Pending', className: 'bg-[#FF9500]/12 text-[#FF9500]' },
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-[#8E8E93]/12 text-[#8E8E93]' }
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold', config.className, className)}>
      {config.label}
    </span>
  )
}

export function AdmissionTypeBadge({ type }: { type: string }) {
  const config = statusConfig[type] ?? { label: type, className: 'bg-[#8E8E93]/12 text-[#8E8E93]' }
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold', config.className)}>
      {config.label}
    </span>
  )
}
