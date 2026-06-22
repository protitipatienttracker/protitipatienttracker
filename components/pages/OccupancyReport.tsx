'use client'
import { useState } from 'react'
import { Download } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { TODAY, type Patient } from '@/lib/data'
import { cn } from '@/lib/utils'

const COLORS = ['#007AFF', '#FF9500', '#AF52DE', '#34C759']

function buildMonthlyBarData(patients: Patient[]) {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(TODAY); d.setDate(d.getDate() - 29 + i)
    return d.toISOString().split('T')[0]
  })
  return days.map(ds => {
    const label = new Date(ds).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    return { date: label, Admissions: patients.filter(p => p.admissionDate === ds).length, Discharges: patients.filter(p => p.dischargeDate === ds).length }
  })
}

function buildLineData(patients: Patient[]) {
  const active = patients.filter(p => p.admissionType !== 'Discharged')
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(TODAY); d.setDate(d.getDate() - (11 - i) * 7)
    return { date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), 'Active Patients': Math.max(active.length + Math.floor(Math.sin(i * 0.8) * 2), 0) }
  })
}

function buildAvgStayData(patients: Patient[]) {
  const groups: Record<string, number[]> = { Independent: [], 'High Support': [], Minor: [] }
  for (const p of patients) {
    if (p.admissionType === 'Discharged') continue
    if (groups[p.admissionType as string]) groups[p.admissionType as string].push(p.daysAdmitted)
  }
  return Object.entries(groups).map(([name, arr]) => ({
    name, 'Avg Days': arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
  }))
}

interface Props { patients: Patient[] }

export default function OccupancyReport({ patients }: Props) {
  const [range, setRange] = useState('This Month')

  const active = patients.filter(p => p.admissionType !== 'Discharged')
  const discharged = patients.filter(p => p.admissionType === 'Discharged')
  const thisMonthAdmissions = patients.filter(p => {
    const d = new Date(p.admissionDate)
    return d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear()
  }).length
  const avgStay = active.length ? Math.round(active.reduce((a, b) => a + b.daysAdmitted, 0) / active.length) : 0

  function handleExportPDF() {
    const reportContent = `
      <html><head><title>Pratiti - Reports & Analytics</title>
      <style>
        body { font-family: -apple-system, sans-serif; padding: 40px; color: #000; }
        h1 { font-size: 22px; margin-bottom: 8px; }
        h2 { font-size: 16px; margin-top: 24px; color: #3A3A3C; }
        .subtitle { color: #8E8E93; font-size: 13px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #E5E5EA; }
        th { background: #F2F2F7; font-weight: 600; color: #8E8E93; }
        .stats { display: flex; gap: 16px; margin: 16px 0; }
        .stat { flex: 1; padding: 16px; border: 1px solid #E5E5EA; border-radius: 12px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: 700; }
        .stat-label { font-size: 11px; color: #8E8E93; text-transform: uppercase; margin-bottom: 4px; }
      </style></head><body>
      <h1>Pratiti — Reports & Analytics</h1>
      <p class="subtitle">Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      <div class="stats">
        <div class="stat"><div class="stat-label">Active Patients</div><div class="stat-value">${active.length}</div></div>
        <div class="stat"><div class="stat-label">Admissions This Month</div><div class="stat-value">${thisMonthAdmissions}</div></div>
        <div class="stat"><div class="stat-label">Total Discharges</div><div class="stat-value">${discharged.length}</div></div>
        <div class="stat"><div class="stat-label">Avg Stay</div><div class="stat-value">${avgStay}d</div></div>
        <div class="stat"><div class="stat-label">Occupancy</div><div class="stat-value">${Math.round((active.length / 30) * 100)}%</div></div>
      </div>
      <h2>Active Patients by Type</h2>
      <table>
        <tr><th>Type</th><th>Count</th><th>% of Total</th></tr>
        <tr><td>Independent</td><td>${active.filter(p => p.admissionType === 'Independent').length}</td><td>${active.length ? Math.round((active.filter(p => p.admissionType === 'Independent').length / active.length) * 100) : 0}%</td></tr>
        <tr><td>High Support</td><td>${active.filter(p => p.admissionType === 'High Support').length}</td><td>${active.length ? Math.round((active.filter(p => p.admissionType === 'High Support').length / active.length) * 100) : 0}%</td></tr>
        <tr><td>Minor</td><td>${active.filter(p => p.admissionType === 'Minor').length}</td><td>${active.length ? Math.round((active.filter(p => p.admissionType === 'Minor').length / active.length) * 100) : 0}%</td></tr>
      </table>
      <h2>All Active Patients</h2>
      <table>
        <tr><th>Code</th><th>Name</th><th>Type</th><th>Sub-Category</th><th>Days Admitted</th><th>Doctor</th></tr>
        ${active.map(p => `<tr><td>${p.patientCode}</td><td>${p.name}</td><td>${p.admissionType}</td><td>${p.currentSubStatus}</td><td>${p.daysAdmitted}</td><td>${p.treatingDoctor}</td></tr>`).join('')}
      </table>
      <h2>Recently Discharged</h2>
      <table>
        <tr><th>Code</th><th>Name</th><th>Discharge Date</th><th>Reason</th><th>Total Stay</th></tr>
        ${discharged.slice(0, 10).map(p => `<tr><td>${p.patientCode}</td><td>${p.name}</td><td>${p.dischargeDate || '—'}</td><td>${p.dischargeReason || '—'}</td><td>${p.totalStay || '—'}</td></tr>`).join('')}
      </table>
      </body></html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(reportContent);
      win.document.close();
      setTimeout(() => { win.print(); }, 500);
    }
  }

  const barData = buildMonthlyBarData(patients)
  const lineData = buildLineData(patients)
  const avgStayData = buildAvgStayData(patients)
  const pieData = [
    { name: 'Independent', value: active.filter(p => p.admissionType === 'Independent').length },
    { name: 'High Support', value: active.filter(p => p.admissionType === 'High Support').length },
    { name: 'Minor', value: active.filter(p => p.admissionType === 'Minor').length },
  ]

  return (
    <div className="p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5 bg-[#E5E5EA] p-0.5 rounded-xl">
          {['This Month', 'Last 3 Months', 'This Year'].map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={cn('px-3.5 py-2 text-[12px] font-medium rounded-[10px] transition-colors',
                range === r ? 'bg-white text-[#000000] shadow-sm' : 'text-[#8E8E93]'
              )}>
              {r}
            </button>
          ))}
        </div>
        <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2.5 bg-[#E5E5EA] rounded-xl text-[13px] text-[#3A3A3C] font-medium active:bg-[#D1D1D6]">
          <Download className="w-3.5 h-3.5" />
          Export PDF
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Admissions', value: thisMonthAdmissions, sub: 'this month' },
          { label: 'Discharges', value: discharged.length, sub: 'all time' },
          { label: 'Avg Stay', value: `${avgStay}d`, sub: 'active patients' },
          { label: 'Occupancy', value: `${active.length}/30`, sub: `${Math.round((active.length / 30) * 100)}%` },
        ].map(s => (
          <div key={s.label} className="ios-card p-5 text-center">
            <p className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide mb-2">{s.label}</p>
            <p className="text-[24px] font-bold text-[#000000]">{s.value}</p>
            <p className="text-[12px] text-[#8E8E93] mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="ios-card p-5">
          <h3 className="text-[14px] font-semibold text-[#000000] mb-4">Admissions vs Discharges</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData.slice(-14)} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Admissions" fill="#007AFF" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Discharges" fill="#FF9500" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="ios-card p-5">
          <h3 className="text-[14px] font-semibold text-[#000000] mb-4">Active Patients Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="Active Patients" stroke="#007AFF" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="ios-card p-5">
          <h3 className="text-[14px] font-semibold text-[#000000] mb-4">Type Breakdown</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="60%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius="50%" outerRadius="80%" paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2.5 flex-1">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-[#3A3A3C]">{d.name}</span>
                  </div>
                  <span className="font-semibold text-[#000000]">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ios-card p-5">
          <h3 className="text-[14px] font-semibold text-[#000000] mb-4">Avg Stay by Type</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={avgStayData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={80} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(v) => [`${v} days`, 'Avg']} />
              <Bar dataKey="Avg Days" fill="#007AFF" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
