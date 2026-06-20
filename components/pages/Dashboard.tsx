'use client'
import { Users, Clock, Brain, BedDouble } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { StatusBadge } from '@/components/ui/badge-status'
import { formatDate, type Patient } from '@/lib/data'
import { cn } from '@/lib/utils'

const DONUT_COLORS = ['#0D6E6E', '#F59E0B', '#7C3AED']

interface StatCardProps {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string | number
  sub: string
  subColor?: string
}

function StatCard({ icon, iconBg, label, value, sub, subColor = 'text-slate-500' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>{icon}</span>
      </div>
      <p className="text-3xl font-bold text-slate-800">{value}</p>
      <p className={`text-sm mt-1 ${subColor}`}>{sub}</p>
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

const rowBg = (status: string) => {
  if (status === 'Action Needed') return 'bg-red-50 hover:bg-red-100/60'
  if (status === 'Due Soon') return 'bg-amber-50/60 hover:bg-amber-100/50'
  return 'hover:bg-slate-50'
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
    <div className="p-6 space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-4 h-4 text-green-600" />}
          iconBg="bg-green-100"
          label="Total Active Patients"
          value={active.length}
          sub={`${recentAdmissions} admitted this week`}
          subColor="text-green-600"
        />
        <StatCard
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          iconBg="bg-amber-100"
          label="Renewals Due This Week"
          value={renewalsDue.length}
          sub={overdueRenewals > 0 ? `${overdueRenewals} overdue` : 'All on track'}
          subColor={overdueRenewals > 0 ? 'text-red-600' : 'text-green-600'}
        />
        <StatCard
          icon={<Brain className="w-4 h-4 text-blue-600" />}
          iconBg="bg-blue-100"
          label="Assessments Due"
          value={assessmentsToday.length}
          sub={assessmentsToday[0] ? `Next: ${assessmentsToday[0].name}` : 'None pending'}
          subColor="text-slate-500"
        />
        <StatCard
          icon={<BedDouble className="w-4 h-4 text-[#0D6E6E]" />}
          iconBg="bg-teal-100"
          label="Beds Available"
          value={beds}
          sub="Out of 30 total"
          subColor="text-slate-500"
        />
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Upcoming Actions Table */}
        <div className="xl:col-span-3 bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Upcoming Actions</h2>
            <span className="text-sm text-slate-400">{upcomingActions.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Patient</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium hidden sm:table-cell">Action</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Due Date</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {upcomingActions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400">
                      <p className="font-medium">No upcoming actions</p>
                    </td>
                  </tr>
                ) : (
                  upcomingActions.map((row) => (
                    <tr key={row.id} className={`border-b border-slate-50 last:border-0 transition-colors ${rowBg(row.status)}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{row.name}</p>
                        <p className="text-xs text-slate-400">{row.type}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{row.action}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{row.dueDate}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => onNavigate('all-patients')}
                          className="text-[#0D6E6E] hover:underline font-medium text-sm"
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
        <div className="xl:col-span-2 bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 p-5 flex flex-col">
          <h2 className="text-base font-semibold text-slate-800 mb-1">Admission Type Breakdown</h2>
          <p className="text-sm text-slate-400 mb-3">Active patients only</p>
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
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                  formatter={(v) => [`${v} patients`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            {donutData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[i] }} />
                  <span className="text-slate-600">{d.name}</span>
                </div>
                <span className="font-semibold text-slate-800">{d.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">Total: {active.length} active patients</p>
        </div>
      </div>
    </div>
  )
}
