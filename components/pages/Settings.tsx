'use client'
import { useState, useEffect, useCallback } from 'react'
import { Save, Plus, Pencil, UserX, Info, Loader2 } from 'lucide-react'
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
    emailNotifications: true,
    whatsappNotifications: false,
    whatsappNumber: '',
  })
  const [settingsLoading, setSettingsLoading] = useState(true)

  const sections = ['Facility Info', 'Staff Management', 'Notification Rules', 'Admission Rules']

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
        emailNotifications: map['email_notifications'] !== 'false',
        whatsappNotifications: map['whatsapp_notifications'] === 'true',
        whatsappNumber: map['whatsapp_number'] ?? '',
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
      upsertSetting('email_notifications', String(notifSettings.emailNotifications)),
      upsertSetting('whatsapp_notifications', String(notifSettings.whatsappNotifications)),
      upsertSetting('whatsapp_number', notifSettings.whatsappNumber),
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
    <div className="p-5 sm:p-6 flex gap-6">
      {/* Left nav */}
      <div className="w-48 shrink-0 space-y-1">
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
                <div className="grid grid-cols-3 gap-3">
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
                  <Toggle label="Email notifications" checked={notifSettings.emailNotifications}
                    onChange={() => setNotifSettings(s => ({ ...s, emailNotifications: !s.emailNotifications }))} />
                  <Toggle label="WhatsApp notifications" checked={notifSettings.whatsappNotifications}
                    onChange={() => setNotifSettings(s => ({ ...s, whatsappNotifications: !s.whatsappNotifications }))} />
                  {notifSettings.whatsappNotifications && (
                    <div className="py-3 flex items-center gap-3 ios-separator">
                      <span className="text-[13px] text-[#8E8E93]">Number:</span>
                      <input value={notifSettings.whatsappNumber}
                        onChange={e => setNotifSettings(s => ({ ...s, whatsappNumber: e.target.value }))}
                        placeholder="+91 XXXXX XXXXX"
                        className="flex-1 bg-white rounded-lg px-3 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                    </div>
                  )}
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
          <div className="ios-card p-6 space-y-5">
            <h2 className="text-[17px] font-semibold text-[#000000]">Admission Rules</h2>
            <div className="flex items-start gap-2.5 p-4 bg-[#007AFF]/8 rounded-2xl">
              <Info className="w-4 h-4 text-[#007AFF] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#007AFF]">
                These milestones are system-configured. Contact support to modify.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide">High Support Milestones</h3>
              {[
                { label: 'Initial Period', range: 'Day 1 – 30', subCat: 'HS ≤30 days', action: 'Assessment at day 30' },
                { label: 'Extended 1 (Beyond 30)', range: 'Day 31 – 120', subCat: 'HS >30 days', action: 'Renewal at day 120' },
                { label: 'Extended 2 (Beyond 120)', range: 'Day 121 – 240', subCat: 'HS >120 days', action: 'Renewal at day 240' },
                { label: 'Extended 3 (Beyond 240)', range: 'Day 241 – 420', subCat: 'HS >240 days', action: 'Renewal at day 420' },
                { label: 'Long-term (Beyond 420)', range: 'Day 421 – 600', subCat: 'HS >420 days', action: 'Renewal at day 600' },
                { label: 'Long-term (Beyond 600)', range: 'Day 601 – 780', subCat: 'HS >600 days', action: 'Recurring every 180 days' },
              ].map(rule => (
                <div key={rule.subCat} className="flex items-center gap-4 p-4 bg-[#F2F2F7] rounded-xl">
                  <div className="w-1.5 h-8 bg-[#007AFF] rounded-full shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#000000]">{rule.label}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FF9500]/12 text-[#FF9500] font-semibold">{rule.subCat}</span>
                    </div>
                    <p className="text-[12px] text-[#8E8E93] mt-0.5">{rule.range} · {rule.action}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-2">
              <h3 className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide">Other Types</h3>
              <div className="flex items-center gap-4 p-4 bg-[#F2F2F7] rounded-xl">
                <div className="w-1.5 h-8 bg-[#007AFF] rounded-full shrink-0" />
                <div className="flex-1">
                  <span className="text-[13px] font-semibold text-[#000000]">Independent</span>
                  <p className="text-[12px] text-[#8E8E93] mt-0.5">Requires passing assessment. Regular 30-day reviews.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-[#F2F2F7] rounded-xl">
                <div className="w-1.5 h-8 bg-[#AF52DE] rounded-full shrink-0" />
                <div className="flex-1">
                  <span className="text-[13px] font-semibold text-[#000000]">Minor</span>
                  <p className="text-[12px] text-[#8E8E93] mt-0.5">Parental consent. Auto-transitions at 18th birthday.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
