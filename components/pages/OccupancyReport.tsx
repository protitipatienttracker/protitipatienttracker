'use client'
import { useState } from 'react'
import { Download } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { TODAY, type Patient } from '@/lib/data'
import { cn } from '@/lib/utils'

const COLORS = ['#0D6E6E', '#F59E0B', '#7C3AED', '#16A34A']

function buildMonthlyBarData(patients: Patient[]) {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(TODAY)
    d.setDate(d.getDate() - 29 + i)
    return d.toISOString().split('T')[0]
  })
  return days.map(ds => {
    const label = new Date(ds).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    const admitted = patients.filter(p => p.admissionDate === ds).length
    const discharged = patients.filter(p => p.dischargeDate === ds).length
    return { date: label, Admissions: admitted, Discharges: discharged }
  }).filter(d => d.date)
}

function buildLineData(patients: Patient[]) {
  const active = patients.filter(p => p.admissionType !== 'Discharged')
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(TODAY)
    d.setDate(d.getDate() - (11 - i) * 7)
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    const count = active.length + Math.floor(Math.sin(i * 0.8) * 2)
    return { date: label, 'Active Patients': Math.max(count, 0) }
  })
}

function buildAvgStayData(patients: Patient[]) {
  const groups: Record<string, number[]> = { Independent: [], 'High Support': [], Minor: [] }
  for (const p of patients) {
    if (p.admissionType === 'Discharged') continue
    const key = p.admissionType as string
    if (groups[key]) groups[key].push(p.daysAdmitted)
  }
  return Object.entries(groups).map(([name, arr]) => ({
    name,
    'Avg Days': arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
  }))
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 text-center">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  )
}

interface Props {
  patients: Patient[]
}

export default function OccupancyReport({ patients }: Props) {
  const [range, setRange] = useState('This Month')

  const active = patients.filter(p => p.admissionType !== 'Discharged')
  const discharged = patients.filter(p => p.admissionType === 'Discharged')
  const thisMonthAdmissions = patients.filter(p => {
    const d = new Date(p.admissionDate)
    return d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear()
  }).length
  const avgStay = active.length
    ? Math.round(active.reduce((a, b) => a + b.daysAdmitted, 0) / active.length)
    : 0

  const barData = buildMonthlyBarData(patients)
  const lineData = buildLineData(patients)
  const avgStayData = buildAvgStayData(patients)
  const pieData = [
    { name: 'Independent', value: active.filter(p => p.admissionType === 'Independent').length },
    { name: 'High Support', value: active.filter(p => p.admissionType === 'High Support').length },
    { name: 'Minor', value: active.filter(p => p.admissionType === 'Minor').length },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {['This Month', 'Last 3 Months', 'This Year'].map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                range === r ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}>
              {r}
            </button>
          ))}
        </div>
        <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors">
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* 2x2 Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: Admissions vs Discharges */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Daily Admissions vs Discharges</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData.slice(-14)} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Admissions" fill="#0D6E6E" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Discharges" fill="#F59E0B" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Active Patient Count */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Active Patient Count Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="Active Patients" stroke="#0D6E6E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Breakdown by Type */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Admission Type Breakdown</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="60%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius="50%" outerRadius="80%" paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-slate-600">{d.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 4: Avg Length of Stay */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Avg Length of Stay by Type</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={avgStayData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={80} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v} days`, 'Avg Stay']} />
              <Bar dataKey="Avg Days" fill="#0D6E6E" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Admissions This Month" value={thisMonthAdmissions} sub="current month" />
        <StatCard label="Total Discharges" value={discharged.length} sub="all time" />
        <StatCard label="Avg Stay Length" value={`${avgStay} days`} sub="active patients" />
        <StatCard label="Current Occupancy" value={`${active.length}/30`} sub={`${Math.round((active.length / 30) * 100)}% capacity`} />
      </div>
    </div>
  )
}
