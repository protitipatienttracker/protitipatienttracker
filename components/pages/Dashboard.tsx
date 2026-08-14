'use client'
import { useState, useEffect, useRef } from 'react'
import { Users, Clock, Brain, BedDouble, ChevronRight, ArrowUpRight } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { StatusBadge } from '@/components/ui/badge-status'
import { type Patient } from '@/lib/data'
import { cn } from '@/lib/utils'

const DONUT_COLORS = ['#007AFF', '#FF9500', '#AF52DE']

function useAnimatedNumber(target: number, duration = 700) {
  const [value, setValue] = useState(target)
  const prevRef = useRef(target)
  useEffect(() => {
    const from = prevRef.current
    const diff = target - from
    if (diff === 0) return
    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(from + diff * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    prevRef.current = target
  }, [target, duration])
  return value
}

interface StatCardProps {
  icon: React.ReactNode
  accent: string
  accentBg: string
  label: string
  value: string | number
  sub: string
  subColor?: string
  onClick?: () => void
}

function StatCard({ icon, accent, accentBg, label, value, sub, subColor = 'text-[#8E8E93]', onClick }: StatCardProps) {
  const animatedValue = useAnimatedNumber(typeof value === 'number' ? value : 0)
  const displayValue = typeof value === 'number' ? animatedValue : value
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-[rgba(60,60,67,0.12)] bg-white p-5 flex flex-col gap-3',
        onClick && 'cursor-pointer active:scale-[0.97] transition-transform'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center', accentBg)}>{icon}</span>
        {onClick && <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />}
      </div>
      <div>
        <p className="text-[36px] font-black tracking-tight leading-none" style={{ color: accent }}>{displayValue}</p>
        <p className="text-[13px] font-semibold text-[#000000] mt-1.5">{label}</p>
      </div>
      <p className={cn('text-[12px] font-medium', subColor)}>{sub}</p>
      <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full opacity-[0.07]" style={{ backgroundColor: accent }} />
    </div>
  )
}

interface UpcomingAction {
  id: string; name: string; type: string; action: string; dueDate: string; status: string
}

function buildUpcomingActions(patients: Patient[]): UpcomingAction[] {
  return patients
    .filter(p => p.admissionType !== 'Discharged' && p.nextActionDue !== '—')
    .map(p => {
      const daysUntil = Math.floor((new Date(p.nextActionDue).getTime() - Date.now()) / 86400000)
      let dueLabel = ''
      if (daysUntil < 0) dueLabel = `${Math.abs(daysUntil)}d overdue`
      else if (daysUntil === 0) dueLabel = 'Today'
      else dueLabel = `In ${daysUntil}d`
      return { id: p.id, name: p.name, type: p.admissionType, action: p.nextActionType, dueDate: dueLabel, status: p.status }
    })
    .sort((a, b) => ['Action Needed', 'Due Soon', 'Upcoming', 'On Track'].indexOf(a.status) - ['Action Needed', 'Due Soon', 'Upcoming', 'On Track'].indexOf(b.status))
    .slice(0, 10)
}

interface Props { patients: Patient[]; onNavigate: (page: string) => void }

export default function Dashboard({ patients, onNavigate }: Props) {
  const active = patients.filter(p => p.admissionType !== 'Discharged')
  const renewalsDue = patients.filter(p => p.nextActionType === 'Shift to CHS' && p.admissionType !== 'Discharged')
  const assessmentsToday = patients.filter(p => p.nextActionType === 'Capacity Assessment' && (p.status === 'Action Needed' || p.status === 'Due Soon'))
  const beds = 30 - active.length
  const upcomingActions = buildUpcomingActions(patients)
  const donutData = [
    { name: 'Independent', value: active.filter(p => p.admissionType === 'Independent').length },
    { name: 'High Support', value: active.filter(p => p.admissionType === 'High Support').length },
    { name: 'Minor', value: active.filter(p => p.admissionType === 'Minor').length },
  ]
  const recentAdmissions = active.filter(p => {
    const d = new Date(p.admissionDate); const w = new Date(); w.setDate(w.getDate() - 7); return d >= w
  }).length
  const overdueRenewals = renewalsDue.filter(p => p.nextActionDue !== '—' && new Date(p.nextActionDue) < new Date()).length

  const today = new Date()
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateLabel = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">

      {/* Page header */}
      <div className="flex items-end justify-between border-b border-[rgba(60,60,67,0.1)] pb-5">
        <div>
          <p className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide">{dateLabel}</p>
          <h1 className="text-[24px] font-black text-[#000000] tracking-tight mt-1">{greeting}</h1>
          <p className="text-[13px] text-[#8E8E93] mt-0.5">
            <span className="font-bold text-[#000000]">{active.length}</span> patients currently admitted
          </p>
        </div>
        {overdueRenewals > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-[#FF3B30] animate-pulse" />
            <span className="text-[12px] font-semibold text-[#FF3B30]">{overdueRenewals} overdue</span>
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<Users className="w-4 h-4 text-[#34C759]" />}
          accent="#34C759" accentBg="bg-[#34C759]/10"
          label="Active Patients" value={active.length}
          sub={recentAdmissions > 0 ? `+${recentAdmissions} this week` : 'No new this week'}
          subColor={recentAdmissions > 0 ? 'text-[#34C759]' : 'text-[#8E8E93]'}
          onClick={() => onNavigate('all-patients')}
        />
        <StatCard
          icon={<Clock className="w-4 h-4 text-[#FF9500]" />}
          accent="#FF9500" accentBg="bg-[#FF9500]/10"
          label="Renewals Due" value={renewalsDue.length}
          sub={overdueRenewals > 0 ? `${overdueRenewals} overdue` : 'All on track'}
          subColor={overdueRenewals > 0 ? 'text-[#FF3B30]' : 'text-[#34C759]'}
          onClick={() => onNavigate('renewals-due')}
        />
        <StatCard
          icon={<Brain className="w-4 h-4 text-[#5856D6]" />}
          accent="#5856D6" accentBg="bg-[#5856D6]/10"
          label="Assessments Due" value={assessmentsToday.length}
          sub={assessmentsToday[0] ? `Next: ${assessmentsToday[0].name}` : 'None pending'}
          subColor={assessmentsToday.length > 0 ? 'text-[#5856D6]' : 'text-[#8E8E93]'}
          onClick={() => onNavigate('capacity-assessments')}
        />
        <StatCard
          icon={<BedDouble className="w-4 h-4 text-[#007AFF]" />}
          accent="#007AFF" accentBg="bg-[#007AFF]/10"
          label="Beds Available" value={beds}
          sub={`${active.length} of 30 occupied`}
          onClick={() => onNavigate('occupancy-report')}
        />
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

        {/* Upcoming Actions */}
        <div className="xl:col-span-3 rounded-2xl border border-[rgba(60,60,67,0.12)] bg-white overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-[rgba(60,60,67,0.08)]">
            <div>
              <h2 className="text-[17px] font-bold text-[#000000]">Upcoming Actions</h2>
              <p className="text-[12px] text-[#8E8E93] mt-0.5">Sorted by urgency</p>
            </div>
            <span className="px-2.5 py-1 bg-[#F2F2F7] border border-[rgba(60,60,67,0.08)] rounded-full text-[12px] font-bold text-[#3A3A3C]">{upcomingActions.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[rgba(60,60,67,0.06)]">
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">Patient</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide hidden sm:table-cell">Action</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">Due</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">Status</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {upcomingActions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-14">
                      <p className="text-[15px] font-bold text-[#3A3A3C]">All clear</p>
                      <p className="text-[13px] text-[#8E8E93] mt-1">No upcoming actions</p>
                    </td>
                  </tr>
                ) : upcomingActions.map((row) => (
                  <tr key={row.id} className={cn(
                    'border-b border-[rgba(60,60,67,0.06)] last:border-0 transition-colors',
                    row.status === 'Action Needed' && 'bg-[#FF3B30]/[0.03]',
                    row.status === 'Due Soon' && 'bg-[#FF9500]/[0.03]',
                  )}>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-[#000000]">{row.name}</p>
                      <p className="text-[11px] text-[#8E8E93] mt-0.5">{row.type}</p>
                    </td>
                    <td className="px-5 py-3.5 text-[#3A3A3C] hidden sm:table-cell">{row.action}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn('text-[12px] font-bold',
                        row.dueDate.includes('overdue') ? 'text-[#FF3B30]' :
                        row.dueDate === 'Today' ? 'text-[#FF9500]' : 'text-[#3A3A3C]'
                      )}>{row.dueDate}</span>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={row.status} /></td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => onNavigate('all-patients')}
                        className="flex items-center gap-0.5 text-[#007AFF] font-semibold text-[12px] active:opacity-60">
                        View <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Donut Chart */}
        <div className="xl:col-span-2 rounded-2xl border border-[rgba(60,60,67,0.12)] bg-white p-5 flex flex-col">
          <div className="border-b border-[rgba(60,60,67,0.08)] pb-3 mb-3">
            <h2 className="text-[17px] font-bold text-[#000000]">Admission Breakdown</h2>
            <p className="text-[12px] text-[#8E8E93] mt-0.5">Active patients by type</p>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" paddingAngle={3} dataKey="value">
                  {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid rgba(60,60,67,0.12)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(v) => [`${v} patients`, '']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-[rgba(60,60,67,0.08)]">
            {donutData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i] }} />
                  <span className="text-[13px] text-[#3A3A3C]">{d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-black text-[#000000]">{d.value}</span>
                  <span className="text-[11px] text-[#8E8E93] w-8 text-right">
                    {active.length > 0 ? `${Math.round((d.value / active.length) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[rgba(60,60,67,0.08)] flex items-center justify-between">
            <span className="text-[12px] text-[#8E8E93] font-medium">Total active</span>
            <span className="text-[18px] font-black text-[#000000]">{active.length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
