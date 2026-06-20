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
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        onClick={onChange}
        className={cn('relative w-10 h-5 rounded-full transition-colors shrink-0', checked ? 'bg-[#0D6E6E]' : 'bg-slate-200')}
      >
        <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
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

  // Load staff from Supabase
  const loadStaff = useCallback(async () => {
    setStaffLoading(true)
    const { data } = await fetchStaff()
    if (data) setStaff(data)
    setStaffLoading(false)
  }, [])

  // Load settings from Supabase
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
    onAddToast('success', 'Facility info saved', 'Changes have been applied.')
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
    onAddToast('success', 'Staff member added', `${newStaff.name} has been added.`)
    setNewStaff({ name: '', role: 'Psychiatrist', email: '' })
    setShowAddStaff(false)
  }

  return (
    <div className="p-6 flex gap-6">
      {/* Left nav */}
      <div className="w-48 shrink-0 space-y-0.5">
        {sections.map(s => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={cn(
              'w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors',
              section === s ? 'bg-[#0D6E6E] text-white font-medium' : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">

        {/* Facility Info */}
        {section === 'Facility Info' && (
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-800">Facility Information</h2>
            {settingsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : (
              <>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Facility Name</label>
                    <input value={facility.name} onChange={e => setFacility(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Address</label>
                    <textarea value={facility.address} onChange={e => setFacility(f => ({ ...f, address: e.target.value }))} rows={2}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">License Number</label>
                      <input value={facility.licenseNo} onChange={e => setFacility(f => ({ ...f, licenseNo: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">Total Bed Count</label>
                      <input type="number" value={facility.totalBeds} onChange={e => setFacility(f => ({ ...f, totalBeds: Number(e.target.value) }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={handleSaveFacility}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0D6E6E] text-white rounded-lg text-sm font-medium hover:bg-[#0A5858]">
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Staff Management */}
        {section === 'Staff Management' && (
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Staff Management</h2>
              <button onClick={() => setShowAddStaff(true)} className="flex items-center gap-1.5 px-3 py-2 bg-[#0D6E6E] text-white rounded-lg text-xs font-medium hover:bg-[#0A5858]">
                <Plus className="w-3.5 h-3.5" />
                Add Staff Member
              </button>
            </div>
            {showAddStaff && (
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                    <input value={newStaff.name} onChange={e => setNewStaff(s => ({ ...s, name: e.target.value }))}
                      placeholder="Full name" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                    <select value={newStaff.role} onChange={e => setNewStaff(s => ({ ...s, role: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-[#0D6E6E]/30">
                      {['Psychiatrist', 'Consultant', 'Clinical Coordinator', 'Admin Staff', 'Nurse'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                    <input value={newStaff.email} onChange={e => setNewStaff(s => ({ ...s, email: e.target.value }))}
                      placeholder="email@example.com" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAddStaff(false)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white">Cancel</button>
                  <button onClick={handleAddStaff} className="px-3 py-1.5 text-xs bg-[#0D6E6E] text-white rounded-lg hover:bg-[#0A5858]">Add Staff</button>
                </div>
              </div>
            )}
            {staffLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Name', 'Role', 'Email', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-sm">No staff members found. Add one above.</td></tr>
                    ) : (
                      staff.map((s, i) => (
                        <tr key={s.id} className={cn('border-b border-slate-50 last:border-0', i % 2 === 1 ? 'bg-slate-50/40' : '')}>
                          <td className="px-5 py-3.5 font-medium text-slate-800">{s.name}</td>
                          <td className="px-5 py-3.5 text-slate-600">{s.role}</td>
                          <td className="px-5 py-3.5 text-slate-500">{s.email}</td>
                          <td className="px-5 py-3.5">
                            <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
                              s.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                            )}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <button onClick={() => toggleStaffStatus(s)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <UserX className="w-3.5 h-3.5" />
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

        {/* Notification Rules */}
        {section === 'Notification Rules' && (
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-800">Notification Rules</h2>
            {settingsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : (
              <>
                <div className="space-y-0">
                  <Toggle label="Notify when renewal is due" checked={notifSettings.notifyRenewal}
                    onChange={() => setNotifSettings(s => ({ ...s, notifyRenewal: !s.notifyRenewal }))} />
                  {notifSettings.notifyRenewal && (
                    <div className="py-3 flex items-center gap-3 border-b border-slate-100 pl-2">
                      <span className="text-xs text-slate-500">Days before renewal due:</span>
                      <input type="number" value={notifSettings.renewalDaysBefore}
                        onChange={e => setNotifSettings(s => ({ ...s, renewalDaysBefore: Number(e.target.value) }))}
                        className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center outline-none focus:ring-2 focus:ring-[#0D6E6E]/30"
                        min={1} max={30} />
                    </div>
                  )}
                  <Toggle label="Notify when capacity assessment is due" checked={notifSettings.notifyAssessment}
                    onChange={() => setNotifSettings(s => ({ ...s, notifyAssessment: !s.notifyAssessment }))} />
                  <Toggle label="Notify when minor patient approaches 18th birthday" checked={notifSettings.notifyMinorTurning18}
                    onChange={() => setNotifSettings(s => ({ ...s, notifyMinorTurning18: !s.notifyMinorTurning18 }))} />
                  <Toggle label="Email notifications" checked={notifSettings.emailNotifications}
                    onChange={() => setNotifSettings(s => ({ ...s, emailNotifications: !s.emailNotifications }))} />
                  <Toggle label="WhatsApp notifications" checked={notifSettings.whatsappNotifications}
                    onChange={() => setNotifSettings(s => ({ ...s, whatsappNotifications: !s.whatsappNotifications }))} />
                  {notifSettings.whatsappNotifications && (
                    <div className="py-3 flex items-center gap-3 border-b border-slate-100 pl-2">
                      <span className="text-xs text-slate-500">WhatsApp number:</span>
                      <input value={notifSettings.whatsappNumber}
                        onChange={e => setNotifSettings(s => ({ ...s, whatsappNumber: e.target.value }))}
                        placeholder="+91 XXXXX XXXXX"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#0D6E6E]/30" />
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button onClick={handleSaveNotifSettings}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0D6E6E] text-white rounded-lg text-sm font-medium hover:bg-[#0A5858]">
                    <Save className="w-4 h-4" />
                    Save Settings
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Admission Rules */}
        {section === 'Admission Rules' && (
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-slate-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-800">Admission Sub-Category Rules</h2>
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                These milestone thresholds are configured at the system level. Contact support to modify admission rule milestones.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">High Support Milestones</h3>
              {[
                { label: 'Initial Period', range: '0 – 30 days', subCat: 'HS ≤30 days', action: 'Capacity assessment at day 30' },
                { label: 'Extended Period 1', range: '31 – 90 days', subCat: 'HS >30 days', action: 'Renewal required at milestone' },
                { label: 'Extended Period 2', range: '91 – 120 days', subCat: 'HS >90 days', action: 'Reassessment + court review' },
                { label: 'Extended Period 3', range: '121 – 180 days', subCat: 'HS >120 days', action: 'Escalation review required' },
                { label: 'Long-term', range: '180+ days', subCat: 'HS >180 days', action: 'Monthly reviews mandatory' },
              ].map(rule => (
                <div key={rule.subCat} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="w-2 h-8 bg-[#0D6E6E] rounded-full shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">{rule.label}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">{rule.subCat}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{rule.range} &middot; {rule.action}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Other Admission Types</h3>
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="w-2 h-8 bg-teal-500 rounded-full shrink-0" />
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-700">Independent Admission</span>
                  <p className="text-xs text-slate-400 mt-0.5">Requires passing capacity assessment. Regular 30-day assessments.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="w-2 h-8 bg-purple-500 rounded-full shrink-0" />
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-700">Minor Admission</span>
                  <p className="text-xs text-slate-400 mt-0.5">Parental consent required. Auto-transitions at 18th birthday.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
