'use client'
import { useState, useEffect, useRef } from 'react'
import { Users, Clock, Brain, BedDouble } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { StatusBadge } from '@/components/ui/badge-status'
import { formatDate, type Patient } from '@/lib/data'
import { cn } from '@/lib/utils'

const DONUT_COLORS = ['#007AFF', '#FF9500', '#AF52DE']

// Animated counter hook
function useAnimatedNumber(target: number, duration = 600) {
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

// Circular gauge SVG
function OccupancyGauge({ occupied, total }: { occupied: number; total: number }) {
  const pct = Math.round((occupied / total) * 100)
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - occupied / total)
  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#E5E5EA" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" stroke="#007AFF" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 48 48)" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[18px] font-bold text-[#000000]">{pct}%</span>
        <span className="text-[10px] text-[#8E8E93]">occupied</span>
      </div>
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string | number
  sub: string
  subColor?: string
  sparkline?: number[]
  sparkColor?: string
}

function Sparkline({ data, color = '#007AFF' }: { data: number[]; color?: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const h = 24
  const w = 60
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StatCard({ icon, iconBg, label, value, sub, subColor = 'text-[#8E8E93]', sparkline, sparkColor }: StatCardProps) {
  const animatedValue = useAnimatedNumber(typeof value === 'number' ? value : 0)
  const displayValue = typeof value === 'number' ? animatedValue : value
  return (
    <div className="ios-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-medium text-[#8E8E93]">{label}</p>
        <span className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>{icon}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[28px] font-bold text-[#000000] tracking-tight">{displayValue}</p>
          <p className={`text-[13px] mt-1 ${subColor}`}>{sub}</p>
        </div>
        {sparkline && <Sparkline data={sparkline} color={sparkColor} />}
      </div>
    </div>
  )
}

interface UpcomingAction {
  id: string
  name: string
  type: string
  action: string
  dueDate: string
  status: string
}

function buildUpcomingActions(patients: Patient[]): UpcomingAction[] {
  return patients
    .filter(p => p.admissionType !== 'Discharged' && p.nextActionDue !== '—')
    .map(p => {
      const daysUntil = Math.floor((new Date(p.nextActionDue).getTime() - Date.now()) / 86400000)
      let dueLabel = ''
      if (daysUntil < 0) dueLabel = `${Math.abs(daysUntil)}d overdue`
      else if (daysUntil === 0) dueLabel = 'Today'
      else dueLabel = `In ${daysUntil} days`
      return {
        id: p.id,
        name: p.name,
        type: p.admissionType,
        action: p.nextActionType,
        dueDate: dueLabel,
        status: p.status,
      }
    })
    .sort((a, b) => {
      const order = ['Action Needed', 'Due Soon', 'Upcoming', 'On Track']
      return order.indexOf(a.status) - order.indexOf(b.status)
    })
    .slice(0, 10)
}

interface Props {
  patients: Patient[]
  onNavigate: (page: string) => void
}

export default function Dashboard({ patients, onNavigate }: Props) {
  const active = patients.filter(p => p.admissionType !== 'Discharged')
  const renewalsDue = patients.filter(p => p.nextActionType === 'Contract Renewal' && p.admissionType !== 'Discharged')
  const assessmentsToday = patients.filter(p => p.nextActionType === 'Capacity Assessment' && (p.status === 'Action Needed' || p.status === 'Due Soon'))
  const beds = 30 - active.length

  const upcomingActions = buildUpcomingActions(patients)

  const donutData = [
    { name: 'Independent', value: active.filter(p => p.admissionType === 'Independent').length },
    { name: 'High Support', value: active.filter(p => p.admissionType === 'High Support').length },
    { name: 'Minor', value: active.filter(p => p.admissionType === 'Minor').length },
  ]

  const recentAdmissions = active.filter(p => {
    const d = new Date(p.admissionDate)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return d >= weekAgo
  }).length

  const overdueRenewals = renewalsDue.filter(p => {
    if (p.nextActionDue === '—') return false
    return new Date(p.nextActionDue) < new Date()
  }).length

  return (
    <div className="p-5 sm:p-6 space-y-5">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-4 h-4 text-[#34C759]" />}
          iconBg="bg-[#34C759]/10"
          label="Active Patients"
          value={active.length}
          sub={`${recentAdmissions} this week`}
          subColor="text-[#34C759]"
          sparkline={[active.length - 3, active.length - 2, active.length - 1, active.length, active.length - 1, active.length + 1, active.length]}
          sparkColor="#34C759"
        />
        <StatCard
          icon={<Clock className="w-4 h-4 text-[#FF9500]" />}
          iconBg="bg-[#FF9500]/10"
          label="Renewals Due"
          value={renewalsDue.length}
          sub={overdueRenewals > 0 ? `${overdueRenewals} overdue` : 'All on track'}
          subColor={overdueRenewals > 0 ? 'text-[#FF3B30]' : 'text-[#34C759]'}
          sparkline={[2, 3, renewalsDue.length + 1, renewalsDue.length, renewalsDue.length + 2, renewalsDue.length - 1, renewalsDue.length]}
          sparkColor="#FF9500"
        />
        <StatCard
          icon={<Brain className="w-4 h-4 text-[#5856D6]" />}
          iconBg="bg-[#5856D6]/10"
          label="Assessments Due"
          value={assessmentsToday.length}
          sub={assessmentsToday[0] ? `Next: ${assessmentsToday[0].name}` : 'None pending'}
          sparkline={[1, 2, assessmentsToday.length, 3, 2, assessmentsToday.length + 1, assessmentsToday.length]}
          sparkColor="#5856D6"
        />
        <StatCard
          icon={<BedDouble className="w-4 h-4 text-[#007AFF]" />}
          iconBg="bg-[#007AFF]/10"
          label="Beds Available"
          value={beds}
          sub="Out of 30 total"
          sparkline={[beds + 2, beds + 1, beds, beds - 1, beds, beds + 1, beds]}
          sparkColor="#007AFF"
        />
      </div>

      {/* Occupancy Gauge */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="ios-card p-5 flex flex-col items-center col-span-1">
          <OccupancyGauge occupied={active.length} total={30} />
          <p className="text-[13px] text-[#8E8E93] mt-2">{active.length}/30 beds used</p>
        </div>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Upcoming Actions */}
        <div className="xl:col-span-3 ios-card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between ios-separator">
            <h2 className="text-[15px] font-semibold text-[#000000]">Upcoming Actions</h2>
            <span className="text-[13px] text-[#8E8E93]">{upcomingActions.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F2F2F7]/60">
                  <th className="text-left px-5 py-2.5 text-[#8E8E93] font-medium">Patient</th>
                  <th className="text-left px-5 py-2.5 text-[#8E8E93] font-medium hidden sm:table-cell">Action</th>
                  <th className="text-left px-5 py-2.5 text-[#8E8E93] font-medium">Due</th>
                  <th className="text-left px-5 py-2.5 text-[#8E8E93] font-medium">Status</th>
                  <th className="text-left px-5 py-2.5 text-[#8E8E93] font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {upcomingActions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-[#8E8E93]">
                      No upcoming actions
                    </td>
                  </tr>
                ) : (
                  upcomingActions.map((row) => (
                    <tr key={row.id} className={cn(
                      'ios-separator last:[border-bottom:none] transition-colors',
                      row.status === 'Action Needed' && 'bg-[#FF3B30]/5',
                      row.status === 'Due Soon' && 'bg-[#FF9500]/5',
                    )}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-[#000000]">{row.name}</p>
                        <p className="text-[11px] text-[#8E8E93]">{row.type}</p>
                      </td>
                      <td className="px-5 py-3 text-[#3A3A3C] hidden sm:table-cell">{row.action}</td>
                      <td className="px-5 py-3 text-[#3A3A3C]">{row.dueDate}</td>
                      <td className="px-5 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => onNavigate('all-patients')}
                          className="text-[#007AFF] font-medium text-[13px] active:opacity-60"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Donut Chart */}
        <div className="xl:col-span-2 ios-card p-5 flex flex-col">
          <h2 className="text-[15px] font-semibold text-[#000000] mb-1">Admission Breakdown</h2>
          <p className="text-[13px] text-[#8E8E93] mb-3">Active patients only</p>
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={3}
                  dataKey="value"
                >
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(v) => [`${v} patients`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            {donutData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: DONUT_COLORS[i] }} />
                  <span className="text-[#3A3A3C]">{d.name}</span>
                </div>
                <span className="font-semibold text-[#000000]">{d.value}</span>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-[#8E8E93] mt-3">Total: {active.length} active patients</p>
        </div>
      </div>
    </div>
  )
}
