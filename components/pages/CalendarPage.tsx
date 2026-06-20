'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, daysFromNow, daysAgo, TODAY, type Patient } from '@/lib/data'

type ViewMode = 'month' | 'week' | 'day'

interface CalendarEvent {
  id: string
  date: string
  patientName: string
  action: string
  type: 'overdue' | 'renewal' | 'assessment' | 'discharge' | 'admission'
  hour?: number
}

const EVENT_COLORS: Record<CalendarEvent['type'], string> = {
  overdue:    'bg-red-100 text-red-700 border-red-300',
  renewal:    'bg-amber-100 text-amber-700 border-amber-300',
  assessment: 'bg-blue-100 text-blue-700 border-blue-300',
  discharge:  'bg-green-100 text-green-700 border-green-300',
  admission:  'bg-purple-100 text-purple-700 border-purple-300',
}

const EVENT_DOT: Record<CalendarEvent['type'], string> = {
  overdue:    'bg-red-500',
  renewal:    'bg-amber-500',
  assessment: 'bg-blue-500',
  discharge:  'bg-green-500',
  admission:  'bg-purple-500',
}

const LEGEND = [
  { type: 'overdue' as const, label: 'Overdue' },
  { type: 'renewal' as const, label: 'Renewal Due' },
  { type: 'assessment' as const, label: 'Capacity Assessment' },
  { type: 'discharge' as const, label: 'Discharge' },
  { type: 'admission' as const, label: 'Admission' },
]

const DAY_HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8am - 8pm

function buildEvents(patients: Patient[]): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const p of patients) {
    if (p.admissionType === 'Discharged') {
      if (p.dischargeDate) {
        events.push({ id: `disc-${p.id}`, date: p.dischargeDate, patientName: p.name, action: 'Discharged', type: 'discharge' })
      }
    } else {
      if (p.nextActionDue && p.nextActionDue !== '—') {
        const t = p.nextActionType.includes('Renewal') ? 'renewal'
          : p.nextActionType.includes('Assessment') ? 'assessment'
          : p.nextActionType.includes('Turns') ? 'renewal'
          : 'assessment'
        events.push({ id: `action-${p.id}`, date: p.nextActionDue, patientName: p.name, action: p.nextActionType, type: t, hour: 10 + (p.id.charCodeAt(3) % 8) })
      }
      if (p.admissionDate) {
        events.push({ id: `adm-${p.id}`, date: p.admissionDate, patientName: p.name, action: 'Admission', type: 'admission', hour: 9 })
      }
    }
    for (const a of p.assessments) {
      events.push({ id: `asmt-${a.id}`, date: a.date, patientName: p.name, action: `Assessment (${a.result})`, type: 'assessment', hour: 11 })
    }
  }
  return events
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

interface Props {
  patients: Patient[]
  onViewPatient?: (id: string) => void
}

export default function CalendarPage({ patients, onViewPatient }: Props) {
  const [view, setView] = useState<ViewMode>('month')
  const [current, setCurrent] = useState({ year: TODAY.getFullYear(), month: TODAY.getMonth() })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [popupEvent, setPopupEvent] = useState<CalendarEvent | null>(null)

  const events = buildEvents(patients)

  function eventsForDate(dateStr: string) {
    return events.filter(e => e.date === dateStr)
  }

  function dateStr(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function prevMonth() {
    setCurrent(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 })
  }
  function nextMonth() {
    setCurrent(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 })
  }

  const todayStr = TODAY.toISOString().split('T')[0]
  const totalDays = getDaysInMonth(current.year, current.month)
  const firstDay = getFirstDayOfMonth(current.year, current.month)
  const monthEvents = events.filter(e => e.date.startsWith(`${current.year}-${String(current.month + 1).padStart(2, '0')}`))

  // Week view: find the week containing "today"
  const todayDayOfWeek = TODAY.getDay()
  const weekStart = new Date(TODAY)
  weekStart.setDate(TODAY.getDate() - todayDayOfWeek)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  return (
    <div className="p-6 flex gap-4 h-full min-h-0">
      {/* Main Calendar */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold text-slate-800 w-44 text-center">
              {MONTHS[current.month]} {current.year}
            </h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {(['month', 'week', 'day'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors',
                  view === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Month View */}
        {view === 'month' && (
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-100">
              {DAYS_SHORT.map(d => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }, (_, i) => (
                <div key={`empty-${i}`} className="border-b border-r border-slate-50 min-h-[100px] bg-slate-50/30" />
              ))}
              {Array.from({ length: totalDays }, (_, i) => {
                const day = i + 1
                const ds = dateStr(current.year, current.month, day)
                const dayEvents = eventsForDate(ds)
                const isToday = ds === todayStr
                const col = (firstDay + i) % 7
                return (
                  <div
                    key={day}
                    className={cn(
                      'min-h-[100px] border-b border-r border-slate-100 p-1.5 cursor-pointer transition-colors',
                      col === 6 ? 'border-r-0' : '',
                      isToday ? 'bg-teal-50/40' : 'hover:bg-slate-50/70'
                    )}
                    onClick={() => setSelectedDate(ds)}
                  >
                    <div className={cn(
                      'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1',
                      isToday ? 'bg-[#0D6E6E] text-white' : 'text-slate-600'
                    )}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(ev => (
                        <button
                          key={ev.id}
                          onClick={e => { e.stopPropagation(); setPopupEvent(ev) }}
                          className={cn('w-full text-left text-[11px] px-1.5 py-0.5 rounded border truncate', EVENT_COLORS[ev.type])}
                        >
                          {ev.patientName.split(' ')[0]} – {ev.action.split(' ')[0]}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[11px] text-slate-400 pl-1">+{dayEvents.length - 3} more</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Week View */}
        {view === 'week' && (
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-100">
              {weekDates.map((ds, i) => {
                const d = new Date(ds)
                return (
                  <div key={ds} className={cn('py-3 px-2 text-center border-r border-slate-100 last:border-r-0', ds === todayStr ? 'bg-teal-50' : '')}>
                    <p className="text-xs text-slate-500">{DAYS_SHORT[i]}</p>
                    <p className={cn('text-sm font-semibold mt-0.5', ds === todayStr ? 'text-[#0D6E6E]' : 'text-slate-700')}>
                      {new Date(ds).getDate()}
                    </p>
                  </div>
                )
              })}
            </div>
            <div className="grid grid-cols-7 divide-x divide-slate-100 min-h-[400px]">
              {weekDates.map(ds => {
                const dayEvs = eventsForDate(ds)
                return (
                  <div key={ds} className={cn('p-2 space-y-1', ds === todayStr ? 'bg-teal-50/30' : '')}>
                    {dayEvs.map(ev => (
                      <button
                        key={ev.id}
                        onClick={() => setPopupEvent(ev)}
                        className={cn('w-full text-left text-[11px] px-2 py-1.5 rounded border', EVENT_COLORS[ev.type])}
                      >
                        <p className="font-semibold truncate">{ev.patientName}</p>
                        <p className="truncate opacity-80">{ev.action}</p>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Day View */}
        {view === 'day' && (
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800">
                {new Date(todayStr).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="divide-y divide-slate-50">
              {DAY_HOURS.map(hour => {
                const hourEvents = events.filter(e => e.date === todayStr && (e.hour === hour || (!e.hour && hour === 9)))
                return (
                  <div key={hour} className="flex gap-4 px-4 py-3 min-h-[60px]">
                    <div className="w-12 shrink-0">
                      <span className="text-xs text-slate-400 font-mono">{hour}:00</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      {hourEvents.map(ev => (
                        <button
                          key={ev.id}
                          onClick={() => setPopupEvent(ev)}
                          className={cn('w-full text-left text-xs px-3 py-2 rounded-lg border', EVENT_COLORS[ev.type])}
                        >
                          <span className="font-semibold">{ev.patientName}</span>
                          <span className="opacity-80"> — {ev.action}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar panel */}
      <div className="w-64 shrink-0 space-y-4">
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Events This Month</h3>
          <p className="text-3xl font-bold text-[#0D6E6E]">{monthEvents.length}</p>
          <p className="text-xs text-slate-500 mt-1">across {current.month === TODAY.getMonth() ? 'current' : 'selected'} month</p>
        </div>

        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Event Types</h3>
          <div className="space-y-2">
            {LEGEND.map(l => (
              <div key={l.type} className="flex items-center gap-2">
                <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', EVENT_DOT[l.type])} />
                <span className="text-xs text-slate-600">{l.label}</span>
                <span className="ml-auto text-xs font-semibold text-slate-700">
                  {monthEvents.filter(e => e.type === l.type).length}
                </span>
              </div>
            ))}
          </div>
        </div>

        {selectedDate && (
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-700">
                {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </h3>
              <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              {eventsForDate(selectedDate).length === 0 ? (
                <p className="text-xs text-slate-400">No events</p>
              ) : (
                eventsForDate(selectedDate).map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setPopupEvent(ev)}
                    className={cn('w-full text-left text-[11px] px-2 py-1.5 rounded border', EVENT_COLORS[ev.type])}
                  >
                    <p className="font-semibold">{ev.patientName}</p>
                    <p className="opacity-80">{ev.action}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Event Popup */}
      {popupEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setPopupEvent(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-800">{popupEvent.patientName}</p>
                <p className="text-xs text-slate-500 mt-0.5">{formatDate(popupEvent.date)}</p>
              </div>
              <button onClick={() => setPopupEvent(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', EVENT_COLORS[popupEvent.type])}>
              <div className={cn('w-2 h-2 rounded-full', EVENT_DOT[popupEvent.type])} />
              {popupEvent.action}
            </div>
            {onViewPatient && (
              <button
                onClick={() => {
                  const p = patients.find(p => p.name === popupEvent.patientName)
                  if (p) { onViewPatient(p.id); setPopupEvent(null) }
                }}
                className="w-full py-2 text-sm bg-[#0D6E6E] text-white rounded-lg hover:bg-[#0A5858] font-medium"
              >
                View Patient
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
