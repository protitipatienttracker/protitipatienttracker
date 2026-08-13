'use client'
import { useState, useEffect, useCallback } from 'react'
import { Save, Plus, UserX, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  fetchStaff, addStaffMember, updateStaffStatus,
  fetchSettings, upsertSetting,
} from '@/lib/db'
import type { DbStaff } from '@/lib/supabase'

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-3.5 ios-separator last:[border-bottom:none]">
      <span className="text-[14px] text-[#000000]">{label}</span>
      <button
        onClick={onChange}
        className={cn('relative w-[51px] h-[31px] rounded-full transition-colors shrink-0', checked ? 'bg-[#34C759]' : 'bg-[#E5E5EA]')}
      >
        <div className={cn('absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-[2px]')} />
      </button>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 ios-separator last:[border-bottom:none]">
      <span className="text-[12px] text-[#8E8E93] shrink-0">{label}</span>
      <span className="text-[12px] font-medium text-right" style={{ color: color ?? '#000000' }}>{value}</span>
    </div>
  )
}

interface Props {
  onAddToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void
  initialSection?: string
}

export default function Settings({ onAddToast, initialSection }: Props) {
  const [section, setSection] = useState(initialSection ?? 'Facility Info')
  const [staff, setStaff] = useState<DbStaff[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: '', role: 'Psychiatrist', email: '' })
  const [facility, setFacility] = useState({
    name: '', address: '', licenseNo: '', totalBeds: 30,
  })
  const [notifSettings, setNotifSettings] = useState({
    renewalDaysBefore: 7,
    notifyRenewal: true,
    notifyAssessment: true,
    notifyMinorTurning18: true,
  })
  const [settingsLoading, setSettingsLoading] = useState(true)

  const sections = ['Facility Info', 'Staff Management', 'Notification Rules', 'Admission Rules', 'How to Use']

  const loadStaff = useCallback(async () => {
    setStaffLoading(true)
    const { data } = await fetchStaff()
    if (data) setStaff(data)
    setStaffLoading(false)
  }, [])

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    const { data } = await fetchSettings()
    if (data) {
      const map = Object.fromEntries(data.map(s => [s.key, s.value]))
      setFacility({
        name: map['facility_name'] ?? '',
        address: map['facility_address'] ?? '',
        licenseNo: map['facility_license'] ?? '',
        totalBeds: parseInt(map['facility_total_beds'] ?? '30'),
      })
      setNotifSettings({
        renewalDaysBefore: parseInt(map['notify_renewal_days_before'] ?? '7'),
        notifyRenewal: map['notify_renewal'] !== 'false',
        notifyAssessment: map['notify_assessment'] !== 'false',
        notifyMinorTurning18: map['notify_minor_turning_18'] !== 'false',
      })
    }
    setSettingsLoading(false)
  }, [])

  useEffect(() => { loadStaff(); loadSettings() }, [loadStaff, loadSettings])

  async function handleSaveFacility() {
    await Promise.all([
      upsertSetting('facility_name', facility.name),
      upsertSetting('facility_address', facility.address),
      upsertSetting('facility_license', facility.licenseNo),
      upsertSetting('facility_total_beds', String(facility.totalBeds)),
    ])
    onAddToast('success', 'Facility info saved')
  }

  async function handleSaveNotifSettings() {
    await Promise.all([
      upsertSetting('notify_renewal', String(notifSettings.notifyRenewal)),
      upsertSetting('notify_renewal_days_before', String(notifSettings.renewalDaysBefore)),
      upsertSetting('notify_assessment', String(notifSettings.notifyAssessment)),
      upsertSetting('notify_minor_turning_18', String(notifSettings.notifyMinorTurning18)),
    ])
    onAddToast('success', 'Notification settings saved')
  }

  async function toggleStaffStatus(s: DbStaff) {
    const newStatus = s.status === 'Active' ? 'Inactive' : 'Active'
    const { error } = await updateStaffStatus(s.id, newStatus)
    if (error) { onAddToast('error', 'Failed to update staff'); return }
    setStaff(prev => prev.map(x => x.id === s.id ? { ...x, status: newStatus } : x))
    onAddToast('info', 'Staff status updated')
  }

  async function handleAddStaff() {
    if (!newStaff.name.trim() || !newStaff.email.trim()) {
      onAddToast('error', 'Please fill in name and email')
      return
    }
    const { data, error } = await addStaffMember({
      name: newStaff.name,
      role: newStaff.role,
      email: newStaff.email,
      status: 'Active',
    })
    if (error) { onAddToast('error', 'Failed to add staff', error.message); return }
    if (data) setStaff(prev => [...prev, data])
    onAddToast('success', 'Staff member added')
    setNewStaff({ name: '', role: 'Psychiatrist', email: '' })
    setShowAddStaff(false)
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
      {/* Left nav */}
      <div className="flex sm:flex-col sm:w-48 shrink-0 gap-1 overflow-x-auto sm:overflow-visible">
        {sections.map(s => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={cn(
              'w-full text-left px-4 py-2.5 text-[14px] rounded-xl transition-colors',
              section === s ? 'bg-[#007AFF] text-white font-medium' : 'text-[#3A3A3C] hover:bg-[#E5E5EA] active:bg-[#D1D1D6]'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">

        {section === 'Facility Info' && (
          <div className="ios-card p-6 space-y-5">
            <h2 className="text-[17px] font-semibold text-[#000000]">Facility Information</h2>
            {settingsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#8E8E93]" /></div>
            ) : (
              <>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Facility Name</label>
                    <input value={facility.name} onChange={e => setFacility(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Address</label>
                    <textarea value={facility.address} onChange={e => setFacility(f => ({ ...f, address: e.target.value }))} rows={2}
                      className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] resize-none outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">License Number</label>
                      <input value={facility.licenseNo} onChange={e => setFacility(f => ({ ...f, licenseNo: e.target.value }))}
                        className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] font-mono outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-[#3A3A3C] mb-1.5">Total Beds</label>
                      <input type="number" value={facility.totalBeds} onChange={e => setFacility(f => ({ ...f, totalBeds: Number(e.target.value) }))}
                        className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={handleSaveFacility}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#007AFF] text-white rounded-xl text-[14px] font-medium active:opacity-80">
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {section === 'Staff Management' && (
          <div className="ios-card overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between ios-separator">
              <h2 className="text-[17px] font-semibold text-[#000000]">Staff Management</h2>
              <button onClick={() => setShowAddStaff(true)} className="flex items-center gap-1.5 px-4 py-2 bg-[#007AFF] text-white rounded-xl text-[13px] font-medium active:opacity-80">
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            {showAddStaff && (
              <div className="px-6 py-4 ios-separator bg-[#F2F2F7]/60 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#3A3A3C] mb-1">Name</label>
                    <input value={newStaff.name} onChange={e => setNewStaff(s => ({ ...s, name: e.target.value }))}
                      placeholder="Full name" className="w-full bg-white rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#3A3A3C] mb-1">Role</label>
                    <select value={newStaff.role} onChange={e => setNewStaff(s => ({ ...s, role: e.target.value }))}
                      className="w-full bg-white rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
                      {['Psychiatrist', 'Consultant', 'Clinical Coordinator', 'Admin Staff', 'Nurse'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#3A3A3C] mb-1">Email</label>
                    <input value={newStaff.email} onChange={e => setNewStaff(s => ({ ...s, email: e.target.value }))}
                      placeholder="email@example.com" className="w-full bg-white rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAddStaff(false)} className="px-4 py-2 text-[13px] bg-[#E5E5EA] rounded-xl active:bg-[#D1D1D6]">Cancel</button>
                  <button onClick={handleAddStaff} className="px-4 py-2 text-[13px] bg-[#007AFF] text-white rounded-xl active:opacity-80">Add</button>
                </div>
              </div>
            )}
            {staffLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#8E8E93]" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#F2F2F7]/60">
                      {['Name', 'Role', 'Email', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-[#8E8E93] font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-[#8E8E93] text-[14px]">No staff members found.</td></tr>
                    ) : (
                      staff.map((s) => (
                        <tr key={s.id} className="ios-separator last:[border-bottom:none]">
                          <td className="px-5 py-3.5 font-medium text-[#000000]">{s.name}</td>
                          <td className="px-5 py-3.5 text-[#3A3A3C]">{s.role}</td>
                          <td className="px-5 py-3.5 text-[#8E8E93]">{s.email}</td>
                          <td className="px-5 py-3.5">
                            <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold',
                              s.status === 'Active' ? 'bg-[#34C759]/12 text-[#34C759]' : 'bg-[#8E8E93]/12 text-[#8E8E93]'
                            )}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <button onClick={() => toggleStaffStatus(s)} className="p-2 rounded-lg text-[#8E8E93] hover:text-[#FF3B30] hover:bg-[#FF3B30]/8 transition-colors">
                              <UserX className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {section === 'Notification Rules' && (
          <div className="ios-card p-6 space-y-5">
            <h2 className="text-[17px] font-semibold text-[#000000]">Notification Rules</h2>
            {settingsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#8E8E93]" /></div>
            ) : (
              <>
                <div className="bg-[#F2F2F7] rounded-2xl px-5">
                  <Toggle label="Renewal due notifications" checked={notifSettings.notifyRenewal}
                    onChange={() => setNotifSettings(s => ({ ...s, notifyRenewal: !s.notifyRenewal }))} />
                  {notifSettings.notifyRenewal && (
                    <div className="py-3 flex items-center gap-3 ios-separator">
                      <span className="text-[13px] text-[#8E8E93]">Days before:</span>
                      <input type="number" value={notifSettings.renewalDaysBefore}
                        onChange={e => setNotifSettings(s => ({ ...s, renewalDaysBefore: Number(e.target.value) }))}
                        className="w-16 bg-white rounded-lg px-3 py-1.5 text-[13px] text-center outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                        min={1} max={30} />
                    </div>
                  )}
                  <Toggle label="Assessment due notifications" checked={notifSettings.notifyAssessment}
                    onChange={() => setNotifSettings(s => ({ ...s, notifyAssessment: !s.notifyAssessment }))} />
                  <Toggle label="Minor approaching 18" checked={notifSettings.notifyMinorTurning18}
                    onChange={() => setNotifSettings(s => ({ ...s, notifyMinorTurning18: !s.notifyMinorTurning18 }))} />
                </div>
                <div className="flex justify-end">
                  <button onClick={handleSaveNotifSettings}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#007AFF] text-white rounded-xl text-[14px] font-medium active:opacity-80">
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {section === 'Admission Rules' && (
          <div className="space-y-4">

            {/* Independent */}
            <div className="ios-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#007AFF]" />
                <h2 className="text-[15px] font-semibold text-[#000000]">Independent Admission <span className="text-[12px] font-normal text-[#8E8E93]">(Voluntary)</span></h2>
              </div>
              <p className="text-[13px] text-[#3A3A3C] leading-relaxed">Patient passes a capacity assessment at admission and is admitted voluntarily. No further scheduled CAs. If they lose capacity during their stay, a CA can be done — if they fail, they are shifted to High Support.</p>
              <div className="bg-[#F2F2F7] rounded-xl p-4 space-y-2">
                <Row label="CA at admission" value="Required (Pass = admitted as Independent)" />
                <Row label="Ongoing CAs" value="None scheduled" />
                <Row label="Fail CA during stay" value="Auto-shift to High Support (HS ≤30 days)" color="#FF3B30" />
                <Row label="Discharge" value="Voluntary at any time" />
              </div>
            </div>

            {/* Minor */}
            <div className="ios-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#AF52DE]" />
                <h2 className="text-[15px] font-semibold text-[#000000]">Minor Admission <span className="text-[12px] font-normal text-[#8E8E93]">(Involuntary — under 18)</span></h2>
              </div>
              <p className="text-[13px] text-[#3A3A3C] leading-relaxed">Any patient under 18 years of age. Parental/guardian consent required. No capacity assessment needed during admission.</p>
              <div className="bg-[#F2F2F7] rounded-xl p-4 space-y-2">
                <Row label="Capacity Assessment" value="Not required" />
                <Row label="Discharge before 18" value="Discharged home by parents" />
                <Row label="Turns 18" value="CA required → Independent or High Support" color="#FF9500" />
                <Row label="Re-admission" value="Can be re-admitted as Minor if still under 18" />
              </div>
            </div>

            {/* High Support */}
            <div className="ios-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF9500]" />
                <h2 className="text-[15px] font-semibold text-[#000000]">High Support Admission <span className="text-[12px] font-normal text-[#8E8E93]">(Involuntary)</span></h2>
              </div>
              <p className="text-[13px] text-[#3A3A3C] leading-relaxed">Patient fails a capacity assessment. Admitted involuntarily. Progresses through sub-categories based on duration. CA every 14 days in CHS stages.</p>

              {/* Sub-category table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-[#F2F2F7]">
                      {['Sub-Category', 'Day Range', 'Shift On', 'CA Frequency'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 text-[#8E8E93] font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { sub: 'HS ≤30 days',   range: 'Day 1–30',    shift: 'Day 31',  ca: 'Every 7 days', color: '#FF3B30' },
                      { sub: 'CHS >30 days',  range: 'Day 31–90',   shift: 'Day 91',  ca: 'Every 14 days', color: '#FF9500' },
                      { sub: 'CHS >90 days',  range: 'Day 91–120',  shift: 'Day 121', ca: 'Every 14 days', color: '#FF9500' },
                      { sub: 'CHS >120 days', range: 'Day 121–180', shift: 'Day 181', ca: 'Every 14 days', color: '#FF9500' },
                      { sub: 'CHS >180 days', range: 'Day 181+',    shift: 'Every 181 days (recurring)', ca: 'Every 14 days', color: '#5856D6' },
                    ].map((r, i, arr) => (
                      <tr key={r.sub} className={i < arr.length - 1 ? 'ios-separator' : ''}>
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: r.color + '20', color: r.color }}>{r.sub}</span>
                        </td>
                        <td className="px-3 py-2.5 text-[#3A3A3C]">{r.range}</td>
                        <td className="px-3 py-2.5 text-[#3A3A3C]">{r.shift}</td>
                        <td className="px-3 py-2.5 text-[#3A3A3C]">{r.ca}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Key rules */}
              <div className="space-y-2">
                <h3 className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide">Key Rules</h3>
                <div className="bg-[#F2F2F7] rounded-xl p-4 space-y-2">
                  <Row label="Pass CA at any point" value="Immediately shift to Independent" color="#34C759" />
                  <Row label="Discharge" value="Allowed at any point" />
                  <Row label="Re-admission within 7 days" value="Resume same sub-category" color="#FF9500" />
                  <Row label="Re-admission after 7 days" value="Restart from HS ≤30 days" color="#FF3B30" />
                </div>
              </div>
            </div>

            {/* CA Summary */}
            <div className="ios-card p-5 space-y-3">
              <h2 className="text-[15px] font-semibold text-[#000000]">Capacity Assessment Summary</h2>
              <div className="bg-[#F2F2F7] rounded-xl p-4 space-y-2">
                <Row label="Independent" value="At admission only (no ongoing CAs)" />
                <Row label="HS ≤30 days" value="Every 7 days (4 CAs in 30 days)" />
                <Row label="CHS (all stages)" value="Every 14 days" />
                <Row label="Minor" value="Not required (age-based only)" />
                <Row label="Independent fail CA" value="Auto-shift to HS ≤30 days" color="#FF3B30" />
                <Row label="HS/CHS pass CA" value="Auto-shift to Independent" color="#34C759" />
              </div>
            </div>

          </div>
        )}

        {section === 'How to Use' && (
          <div className="space-y-4">
            <div className="ios-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#007AFF]" />
                <h2 className="text-[15px] font-semibold">Admitting a New Patient</h2>
              </div>
              <ol className="space-y-2 text-[13px] text-[#3A3A3C] list-decimal list-inside leading-relaxed">
                <li>Tap <span className="font-medium">New Admission</span> in the sidebar.</li>
                <li>Fill in patient details — name, DOB, gender, doctor, and admission date (backdating supported).</li>
                <li>Select admission type: <span className="font-medium">Independent</span>, <span className="font-medium">High Support</span>, or <span className="font-medium">Minor</span>.</li>
                <li>For Independent and High Support, complete the capacity assessment in Step 3.</li>
                <li>Review and submit — patient appears immediately in All Patients.</li>
              </ol>
            </div>

            <div className="ios-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#34C759]" />
                <h2 className="text-[15px] font-semibold">Recording a Capacity Assessment</h2>
              </div>
              <ol className="space-y-2 text-[13px] text-[#3A3A3C] list-decimal list-inside leading-relaxed">
                <li>Open the patient's detail page and go to the <span className="font-medium">Assessments</span> tab, or use the timeline.</li>
                <li>Tap <span className="font-medium">Record</span> on the due assessment slot.</li>
                <li>Enter the assessment date, assessor name, and result (Pass / Fail).</li>
                <li><span className="font-medium">Pass</span> on a High Support patient → auto-shifts to Independent.</li>
                <li><span className="font-medium">Fail</span> on an Independent patient → prompts shift to High Support.</li>
              </ol>
            </div>

            <div className="ios-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF9500]" />
                <h2 className="text-[15px] font-semibold">Shifting a CHS Milestone</h2>
              </div>
              <ol className="space-y-2 text-[13px] text-[#3A3A3C] list-decimal list-inside leading-relaxed">
                <li>Open the patient's detail page — the timeline shows all milestone dates.</li>
                <li>When a milestone date is reached, a <span className="font-medium">Shift</span> button appears on that event.</li>
                <li>Tap <span className="font-medium">Shift</span> to advance the patient to the next CHS sub-category.</li>
                <li>Once shifted, the button shows <span className="font-medium">Shifted ✓</span> and the patient's badge updates.</li>
              </ol>
            </div>

            <div className="ios-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF3B30]" />
                <h2 className="text-[15px] font-semibold">Discharging a Patient</h2>
              </div>
              <ol className="space-y-2 text-[13px] text-[#3A3A3C] list-decimal list-inside leading-relaxed">
                <li>Open the patient's detail page and tap <span className="font-medium">Discharge</span>.</li>
                <li>Select the discharge date and reason.</li>
                <li>Confirm — patient moves to the Discharged list.</li>
                <li>An <span className="font-medium">Undo</span> toast appears for 6 seconds to reverse the action if needed.</li>
              </ol>
            </div>

            <div className="ios-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#AF52DE]" />
                <h2 className="text-[15px] font-semibold">Re-admitting a Patient</h2>
              </div>
              <ol className="space-y-2 text-[13px] text-[#3A3A3C] list-decimal list-inside leading-relaxed">
                <li>Go to <span className="font-medium">Discharged</span> in the sidebar and find the patient.</li>
                <li>Tap <span className="font-medium">Re-admit</span> — the form pre-fills with their previous details.</li>
                <li>If re-admitted within 7 days of discharge, High Support patients resume their previous sub-category.</li>
                <li>After 7 days, High Support restarts from <span className="font-medium">HS ≤30 days</span>.</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
