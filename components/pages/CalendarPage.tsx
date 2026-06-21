'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, daysFromNow, daysAgo, TODAY, type Patient } from '@/lib/data'

type ViewMode = 'year' | 'month' | 'week' | 'day'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface CalendarEvent {
  id: string
  date: string
  patientName: string
  action: string
  type: 'overdue' | 'renewal' | 'assessment' | 'discharge' | 'admission'
  hour?: number
}

const EVENT_COLORS: Record<CalendarEvent['type'], string> = {
  overdue:    'bg-[#FF3B30]/10 text-[#FF3B30]',
  renewal:    'bg-[#FF9500]/10 text-[#FF9500]',
  assessment: 'bg-[#007AFF]/10 text-[#007AFF]',
  discharge:  'bg-[#34C759]/10 text-[#34C759]',
  admission:  'bg-[#AF52DE]/10 text-[#AF52DE]',
}

const EVENT_DOT: Record<CalendarEvent['type'], string> = {
  overdue:    'bg-[#FF3B30]',
  renewal:    'bg-[#FF9500]',
  assessment: 'bg-[#007AFF]',
  discharge:  'bg-[#34C759]',
  admission:  'bg-[#AF52DE]',
}

const LEGEND = [
  { type: 'overdue' as const, label: 'Overdue' },
  { type: 'renewal' as const, label: 'Shift to CHS' },
  { type: 'assessment' as const, label: 'Assessment' },
  { type: 'discharge' as const, label: 'Discharge' },
  { type: 'admission' as const, label: 'Admission' },
]

const DAY_HOURS = Array.from({ length: 13 }, (_, i) => i + 8)

function buildEvents(patients: Patient[]): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const p of patients) {
    if (p.admissionType === 'Discharged') {
      if (p.dischargeDate) events.push({ id: `disc-${p.id}`, date: p.dischargeDate, patientName: p.name, action: 'Discharged', type: 'discharge' })
    } else {
      if (p.nextActionDue && p.nextActionDue !== '—') {
        const t = p.nextActionType.includes('Shift') ? 'renewal'
          : p.nextActionType.includes('Assessment') ? 'assessment' : 'assessment'
        events.push({ id: `action-${p.id}`, date: p.nextActionDue, patientName: p.name, action: p.nextActionType, type: t, hour: 10 + (p.id.charCodeAt(3) % 8) })
      }
      if (p.admissionDate) events.push({ id: `adm-${p.id}`, date: p.admissionDate, patientName: p.name, action: 'Admission', type: 'admission', hour: 9 })
    }
    for (const a of p.assessments) {
      events.push({ id: `asmt-${a.id}`, date: a.date, patientName: p.name, action: `Assessment (${a.result})`, type: 'assessment', hour: 11 })
    }
  }
  return events
}

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay() }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

interface Props {
  patients: Patient[]
  onViewPatient?: (id: string) => void
}

export default function CalendarPage({ patients, onViewPatient }: Props) {
  const [view, setView] = useState<ViewMode>('month')
  const [current, setCurrent] = useState({ year: TODAY.getFullYear(), month: TODAY.getMonth() })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [popupEvent, setPopupEvent] = useState<CalendarEvent | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<CalendarEvent['type']>>(new Set(['overdue', 'renewal', 'assessment', 'discharge', 'admission']))

  const allEvents = buildEvents(patients)
  const events = allEvents.filter(e => activeFilters.has(e.type))

  function toggleFilter(type: CalendarEvent['type']) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type); else next.add(type)
      return next
    })
  }

  function eventsForDate(dateStr: string) { return events.filter(e => e.date === dateStr) }
  function dateStr(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function prev() {
    if (view === 'year') setCurrent(c => ({ ...c, year: c.year - 1 }))
    else setCurrent(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 })
  }
  function next() {
    if (view === 'year') setCurrent(c => ({ ...c, year: c.year + 1 }))
    else setCurrent(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 })
  }

  const todayStr = TODAY.toISOString().split('T')[0]
  const totalDays = getDaysInMonth(current.year, current.month)
  const firstDay = getFirstDayOfMonth(current.year, current.month)
  const monthEvents = events.filter(e => e.date.startsWith(`${current.year}-${String(current.month + 1).padStart(2, '0')}`))

  const todayDayOfWeek = TODAY.getDay()
  const weekStart = new Date(TODAY)
  weekStart.setDate(TODAY.getDate() - todayDayOfWeek)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  return (
    <div className="p-5 sm:p-6 flex gap-4 h-full min-h-0">
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={prev} className="p-2 rounded-xl bg-[#E5E5EA] active:bg-[#D1D1D6] text-[#3A3A3C]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-[15px] font-semibold text-[#000000] w-44 text-center">
              {view === 'year' ? current.year : `${MONTHS[current.month]} ${current.year}`}
            </h2>
            <button onClick={next} className="p-2 rounded-xl bg-[#E5E5EA] active:bg-[#D1D1D6] text-[#3A3A3C]">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-0.5 bg-[#E5E5EA] p-0.5 rounded-xl">
            {(['year', 'month', 'week', 'day'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-3 py-2 text-[12px] font-medium rounded-[10px] capitalize transition-colors',
                  view === v ? 'bg-white text-[#000000] shadow-sm' : 'text-[#8E8E93]'
                )}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Year View */}
        {view === 'year' && (
          <div className="ios-card p-4">
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 12 }, (_, monthIdx) => {
                const mDays = getDaysInMonth(current.year, monthIdx)
                const mFirstDay = getFirstDayOfMonth(current.year, monthIdx)
                const monthPrefix = `${current.year}-${String(monthIdx + 1).padStart(2, '0')}`
                const mEvents = events.filter(e => e.date.startsWith(monthPrefix))
                return (
                  <div key={monthIdx} className="bg-[#F2F2F7] rounded-xl p-2">
                    <button onClick={() => { setCurrent({ year: current.year, month: monthIdx }); setView('month') }}
                      className="text-[12px] font-semibold text-[#000000] mb-1 block">
                      {MONTHS_SHORT[monthIdx]}
                      {mEvents.length > 0 && <span className="ml-1 text-[10px] font-normal text-[#8E8E93]">({mEvents.length})</span>}
                    </button>
                    <div className="grid grid-cols-7 gap-px text-[9px] text-[#8E8E93]">
                      {DAYS_SHORT.map(d => <div key={d} className="text-center">{d[0]}</div>)}
                      {Array.from({ length: mFirstDay }, (_, i) => <div key={`e-${i}`} />)}
                      {Array.from({ length: mDays }, (_, i) => {
                        const day = i + 1
                        const ds = dateStr(current.year, monthIdx, day)
                        const dayEvs = eventsForDate(ds)
                        const isToday = ds === todayStr
                        return (
                          <div key={day}
                            className={cn('text-center rounded-sm relative cursor-pointer',
                              isToday ? 'bg-[#007AFF] text-white font-bold' : '',
                              dayEvs.length > 0 && !isToday ? 'font-semibold text-[#000000]' : ''
                            )}
                            onClick={() => { setCurrent({ year: current.year, month: monthIdx }); setSelectedDate(ds); setView('month') }}>
                            {day}
                            {dayEvs.length > 0 && (
                              <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-px">
                                {dayEvs.slice(0, 3).map(ev => <div key={ev.id} className={cn('w-1 h-1 rounded-full', EVENT_DOT[ev.type])} />)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Month View */}
        {view === 'month' && (
          <div className="ios-card overflow-hidden">
            <div className="grid grid-cols-7 ios-separator">
              {DAYS_SHORT.map(d => <div key={d} className="py-2.5 text-center text-[12px] font-medium text-[#8E8E93]">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }, (_, i) => (
                <div key={`empty-${i}`} className="ios-separator min-h-[100px] bg-[#F2F2F7]/30" />
              ))}
              {Array.from({ length: totalDays }, (_, i) => {
                const day = i + 1
                const ds = dateStr(current.year, current.month, day)
                const dayEvents = eventsForDate(ds)
                const isToday = ds === todayStr
                return (
                  <div key={day}
                    className={cn('min-h-[100px] ios-separator p-1.5 cursor-pointer transition-colors',
                      isToday ? 'bg-[#007AFF]/5' : 'hover:bg-[#F2F2F7]/50'
                    )}
                    onClick={() => setSelectedDate(ds)}>
                    <div className={cn('w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-medium mb-1',
                      isToday ? 'bg-[#007AFF] text-white' : 'text-[#3A3A3C]')}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(ev => (
                        <button key={ev.id} onClick={e => { e.stopPropagation(); setPopupEvent(ev) }}
                          className={cn('w-full text-left text-[10px] px-1.5 py-0.5 rounded-md truncate font-medium', EVENT_COLORS[ev.type])}>
                          {ev.patientName.split(' ')[0]} – {ev.action.split(' ')[0]}
                        </button>
                      ))}
                      {dayEvents.length > 3 && <p className="text-[10px] text-[#8E8E93] pl-1">+{dayEvents.length - 3}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Week View */}
        {view === 'week' && (
          <div className="ios-card overflow-hidden">
            <div className="grid grid-cols-7 ios-separator">
              {weekDates.map((ds, i) => (
                <div key={ds} className={cn('py-3 px-2 text-center', ds === todayStr ? 'bg-[#007AFF]/5' : '')}>
                  <p className="text-[11px] text-[#8E8E93]">{DAYS_SHORT[i]}</p>
                  <p className={cn('text-[14px] font-semibold mt-0.5', ds === todayStr ? 'text-[#007AFF]' : 'text-[#000000]')}>
                    {new Date(ds).getDate()}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-[rgba(60,60,67,0.08)] min-h-[400px]">
              {weekDates.map(ds => (
                <div key={ds} className={cn('p-2 space-y-1', ds === todayStr ? 'bg-[#007AFF]/3' : '')}>
                  {eventsForDate(ds).map(ev => (
                    <button key={ev.id} onClick={() => setPopupEvent(ev)}
                      className={cn('w-full text-left text-[11px] px-2 py-1.5 rounded-lg font-medium', EVENT_COLORS[ev.type])}>
                      <p className="truncate">{ev.patientName}</p>
                      <p className="truncate opacity-70">{ev.action}</p>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Day View */}
        {view === 'day' && (
          <div className="ios-card overflow-hidden">
            <div className="px-5 py-3 ios-separator bg-[#F2F2F7]/60">
              <p className="text-[14px] font-semibold text-[#000000]">
                {new Date(todayStr).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div>
              {DAY_HOURS.map(hour => {
                const hourEvents = events.filter(e => e.date === todayStr && (e.hour === hour || (!e.hour && hour === 9)))
                return (
                  <div key={hour} className="flex gap-4 px-5 py-3 min-h-[56px] ios-separator last:[border-bottom:none]">
                    <div className="w-12 shrink-0">
                      <span className="text-[12px] text-[#8E8E93] font-mono">{hour}:00</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      {hourEvents.map(ev => (
                        <button key={ev.id} onClick={() => setPopupEvent(ev)}
                          className={cn('w-full text-left text-[12px] px-3 py-2 rounded-xl font-medium', EVENT_COLORS[ev.type])}>
                          <span className="font-semibold">{ev.patientName}</span> — {ev.action}
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

      {/* Sidebar */}
      <div className="w-60 shrink-0 space-y-4">
        <div className="ios-card p-4">
          <h3 className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">This Month</h3>
          <p className="text-[28px] font-bold text-[#007AFF]">{monthEvents.length}</p>
          <p className="text-[12px] text-[#8E8E93] mt-0.5">events</p>
        </div>

        <div className="ios-card p-4">
          <h3 className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">Filters</h3>
          <div className="space-y-2.5">
            {LEGEND.map(l => (
              <label key={l.type} className="flex items-center gap-2.5 cursor-pointer">
                <div className={cn('w-4 h-4 rounded-md flex items-center justify-center transition-colors',
                  activeFilters.has(l.type) ? `${EVENT_DOT[l.type]}` : 'bg-[#E5E5EA]'
                )}>
                  {activeFilters.has(l.type) && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-[13px] text-[#3A3A3C]" onClick={() => toggleFilter(l.type)}>{l.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 pt-3 ios-separator flex gap-3">
            <button onClick={() => setActiveFilters(new Set(['overdue', 'renewal', 'assessment', 'discharge', 'admission']))}
              className="text-[12px] text-[#007AFF] font-medium active:opacity-60">All</button>
            <button onClick={() => setActiveFilters(new Set())}
              className="text-[12px] text-[#8E8E93] font-medium active:opacity-60">None</button>
          </div>
        </div>

        {selectedDate && (
          <div className="ios-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold text-[#000000]">
                {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </h3>
              <button onClick={() => setSelectedDate(null)} className="text-[#8E8E93] active:text-[#3A3A3C]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              {eventsForDate(selectedDate).length === 0 ? (
                <p className="text-[12px] text-[#8E8E93]">No events</p>
              ) : (
                eventsForDate(selectedDate).map(ev => (
                  <button key={ev.id} onClick={() => setPopupEvent(ev)}
                    className={cn('w-full text-left text-[11px] px-3 py-2 rounded-xl font-medium', EVENT_COLORS[ev.type])}>
                    <p className="font-semibold">{ev.patientName}</p>
                    <p className="opacity-70">{ev.action}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Popup */}
      {popupEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setPopupEvent(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-5 space-y-3" style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-[#000000] text-[15px]">{popupEvent.patientName}</p>
                <p className="text-[12px] text-[#8E8E93] mt-0.5">{formatDate(popupEvent.date)}</p>
              </div>
              <button onClick={() => setPopupEvent(null)} className="w-7 h-7 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[#8E8E93]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold', EVENT_COLORS[popupEvent.type])}>
              <div className={cn('w-2 h-2 rounded-full', EVENT_DOT[popupEvent.type])} />
              {popupEvent.action}
            </span>
            {onViewPatient && (
              <button
                onClick={() => { const p = patients.find(p => p.name === popupEvent.patientName); if (p) { onViewPatient(p.id); setPopupEvent(null) } }}
                className="w-full py-2.5 text-[14px] bg-[#007AFF] text-white rounded-xl font-medium active:opacity-80">
                View Patient
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
