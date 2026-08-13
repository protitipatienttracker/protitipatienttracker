/**
 * Fresh seed — no billing, all dates relative to today.
 * Run: node --env-file=.env.local scripts/seed-mock-data.mjs
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const TODAY = new Date().toISOString().split('T')[0]

function addDays(d, n) {
  const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0]
}
const ago  = n => addDays(TODAY, -n)
const from = n => addDays(TODAY, n)

async function ins(table, rows) {
  const { data, error } = await sb.from(table).insert(rows).select()
  if (error) { console.error(`❌ ${table}:`, error.message); process.exit(1) }
  return data
}

async function notif(rows) {
  for (const r of rows) await sb.from('notifications').insert([r])
}

// ── helpers ──────────────────────────────────────────────────────────────────
const { data: existing } = await sb.from('patients').select('patient_code')
const used = (existing ?? []).map(r => parseInt(r.patient_code.replace('PT-', ''))).filter(Boolean)
let ctr = Math.max(...used, 0) + 1
const code = () => `PT-${String(ctr++).padStart(3, '0')}`

// ─────────────────────────────────────────────────────────────────────────────
// PT1 — Independent, admitted 20 days ago
// CA on day 14 (recorded, Pass). Next CA due in 8 days (day 28 from admission).
// ─────────────────────────────────────────────────────────────────────────────
{
  const adm = ago(20), c = code()
  const [p] = await ins('patients', [{ patient_code: c, full_name: 'Meera Iyer', date_of_birth: '1988-04-12', gender: 'Female', phone: '9876543210', treating_doctor: 'Dr. Rajan Pillai', emergency_contact_name: 'Suresh Iyer', emergency_contact_phone: '9876543211', address: '14, MG Road, Pune', facility: 'Pratiti' }])
  const [a] = await ins('admissions', [{ patient_id: p.id, admission_type: 'Independent', sub_category: 'Independent', admission_date: adm, status: 'Active', admitted_by: 'Arjun Sathe' }])
  const ca1 = addDays(adm, 14)
  await ins('capacity_assessments', [{ patient_id: p.id, admission_id: a.id, assessment_date: ca1, assessed_by: 'Dr. Rajan Pillai', result: 'Pass', notes: 'Patient oriented and coherent.', next_assessment_due: addDays(ca1, 14) }])
  await ins('clinical_notes', [{ patient_id: p.id, admission_id: a.id, note_date: addDays(adm, 2), author: 'Arjun Sathe', note_type: 'Clinical', content: 'Patient settled in. No acute distress.' }])
  // Upcoming fortnightly CA notifications
  let next = addDays(ca1, 14); let i = 2
  while (next <= from(180)) {
    await notif([{ patient_id: p.id, type: 'Assessment Due', message: `CA #${i} due for ${p.full_name} (${c}) — Independent`, due_date: next, is_read: false }])
    next = addDays(next, 14); i++
  }
  console.log(`✅ PT1 Independent: ${p.full_name} (${c}) — admitted ${adm}, CA#1 recorded ${ca1}, next CA ${addDays(ca1,14)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// PT2 — High Support ≤30 days, admitted 10 days ago
// Week 1 CA recorded (Fail, day 7). Week 2 CA due in 4 days (day 14).
// Week 3 due day 21, Week 4 due day 28. Day 31 → shift to CHS.
// ─────────────────────────────────────────────────────────────────────────────
{
  const adm = ago(10), c = code()
  const [p] = await ins('patients', [{ patient_code: c, full_name: 'Rajesh Nambiar', date_of_birth: '1975-09-03', gender: 'Male', phone: '9845001234', treating_doctor: 'Dr. Anand Krishnan', emergency_contact_name: 'Latha Nambiar', emergency_contact_phone: '9845001235', address: '7, Shivaji Nagar, Nagpur', facility: 'Pratiti' }])
  const [a] = await ins('admissions', [{ patient_id: p.id, admission_type: 'High Support', sub_category: 'HS ≤30 days', admission_date: adm, status: 'Active', admitted_by: 'Kavitha Menon' }])
  const ca1 = addDays(adm, 7)
  await ins('capacity_assessments', [{ patient_id: p.id, admission_id: a.id, assessment_date: ca1, assessed_by: 'Dr. Anand Krishnan', result: 'Fail', notes: 'Patient lacks decision-making capacity.', next_assessment_due: addDays(ca1, 7) }])
  await ins('clinical_notes', [{ patient_id: p.id, admission_id: a.id, note_date: addDays(adm, 1), author: 'Kavitha Menon', note_type: 'Legal', content: 'Admitted under Section 89. Family informed.' }])
  await notif([
    { patient_id: p.id, type: 'Assessment Due', message: `Week 2 CA due for ${p.full_name} (${c}) — HS ≤30 days`, due_date: addDays(adm, 14), is_read: false },
    { patient_id: p.id, type: 'Assessment Due', message: `Week 3 CA due for ${p.full_name} (${c}) — HS ≤30 days`, due_date: addDays(adm, 21), is_read: false },
    { patient_id: p.id, type: 'Assessment Due', message: `Week 4 CA due for ${p.full_name} (${c}) — HS ≤30 days`, due_date: addDays(adm, 28), is_read: false },
    { patient_id: p.id, type: 'Sub-Category Shift', message: `${p.full_name} (${c}) reaches day 31 — review for shift to CHS`, due_date: addDays(adm, 31), is_read: false },
  ])
  console.log(`✅ PT2 HS ≤30 days: ${p.full_name} (${c}) — admitted ${adm}, Week1 CA recorded ${ca1}, Week2 due ${addDays(adm,14)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// PT3 — CHS >30 days, admitted 50 days ago
// All 4 HS weekly CAs recorded (Fail). Shifted to CHS on day 31.
// 1 CHS fortnightly CA recorded (day 45, Fail). Next CHS CA due in ~9 days.
// ─────────────────────────────────────────────────────────────────────────────
{
  const adm = ago(50), c = code()
  const chsStart = addDays(adm, 31)
  const [p] = await ins('patients', [{ patient_code: c, full_name: 'Sunita Deshmukh', date_of_birth: '1982-12-25', gender: 'Female', phone: '9900112233', treating_doctor: 'Dr. Rajan Pillai', emergency_contact_name: 'Vikram Deshmukh', emergency_contact_phone: '9900112234', address: '22, Baner Road, Pune', facility: 'Pratiti' }])
  const [a] = await ins('admissions', [{ patient_id: p.id, admission_type: 'High Support', sub_category: 'CHS >30 days', admission_date: adm, status: 'Active', admitted_by: 'Arjun Sathe' }])
  // 4 weekly HS CAs
  for (let w = 1; w <= 4; w++) {
    const d = addDays(adm, w * 7)
    await ins('capacity_assessments', [{ patient_id: p.id, admission_id: a.id, assessment_date: d, assessed_by: 'Dr. Rajan Pillai', result: 'Fail', notes: `HS Week ${w} — capacity not regained.`, next_assessment_due: addDays(d, 7) }])
  }
  // 1 CHS fortnightly CA
  const chs1 = addDays(adm, 45)
  await ins('capacity_assessments', [{ patient_id: p.id, admission_id: a.id, assessment_date: chs1, assessed_by: 'Dr. Rajan Pillai', result: 'Fail', notes: 'CHS #1 — no change.', next_assessment_due: addDays(chs1, 14) }])
  await ins('transfers', [{ patient_id: p.id, from_admission_id: a.id, to_admission_id: a.id, transfer_date: chsStart, from_type: 'HS ≤30 days', to_type: 'CHS >30 days', reason: 'Capacity not regained after 30 days', triggered_by: 'System' }])
  await ins('clinical_notes', [{ patient_id: p.id, admission_id: a.id, note_date: addDays(adm, 5), author: 'Dr. Rajan Pillai', note_type: 'Clinical', content: 'Patient unresponsive to verbal prompts. Medication initiated.' }])
  // Upcoming CHS CAs
  let next = addDays(chs1, 14); let i = 2
  const limit = addDays(adm, 120)
  while (next <= limit) {
    await notif([{ patient_id: p.id, type: 'Assessment Due', message: `CHS fortnightly CA #${i} due for ${p.full_name} (${c})`, due_date: next, is_read: false }])
    next = addDays(next, 14); i++
  }
  await notif([{ patient_id: p.id, type: 'Sub-Category Shift', message: `${p.full_name} (${c}) reaches day 120 — review for shift to CHS >90 days`, due_date: addDays(adm, 120), is_read: false }])
  console.log(`✅ PT3 CHS >30 days: ${p.full_name} (${c}) — admitted ${adm}, CHS CA#1 recorded ${chs1}, next ${addDays(chs1,14)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// PT4 — Minor, admitted 30 days ago, turns 18 in ~8 months
// ─────────────────────────────────────────────────────────────────────────────
{
  const adm = ago(30), c = code()
  const dob = addDays(TODAY, -(17 * 365 + 120))
  const [p] = await ins('patients', [{ patient_code: c, full_name: 'Aryan Kapoor', date_of_birth: dob, gender: 'Male', phone: null, treating_doctor: 'Dr. Pradeep Nair', emergency_contact_name: 'Ramesh Kapoor', emergency_contact_phone: '9711223344', address: '5, Sector 12, Noida', facility: 'Pratiti' }])
  const [a] = await ins('admissions', [{ patient_id: p.id, admission_type: 'Minor', sub_category: 'Minor', admission_date: adm, status: 'Active', admitted_by: 'Arjun Sathe' }])
  await ins('clinical_notes', [{ patient_id: p.id, admission_id: a.id, note_date: addDays(adm, 3), author: 'Dr. Pradeep Nair', note_type: 'Clinical', content: 'Guardian consent obtained. Treatment plan initiated.' }])
  const eighteenth = (() => { const d = new Date(dob); d.setFullYear(d.getFullYear() + 18); return d.toISOString().split('T')[0] })()
  await notif([{ patient_id: p.id, type: 'Minor Turning 18', message: `${p.full_name} (${c}) turns 18 on ${eighteenth} — capacity assessment required`, due_date: eighteenth, is_read: false }])
  console.log(`✅ PT4 Minor: ${p.full_name} (${c}) — admitted ${adm}, turns 18 ${eighteenth}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// PT5 — Discharged Independent, admitted 60 days ago, discharged 5 days ago
// ─────────────────────────────────────────────────────────────────────────────
{
  const adm = ago(60), disc = ago(5), c = code()
  const [p] = await ins('patients', [{ patient_code: c, full_name: 'Kavitha Varma', date_of_birth: '1992-07-10', gender: 'Female', phone: '9988776655', treating_doctor: 'Arjun Sathe', emergency_contact_name: 'Mohan Varma', emergency_contact_phone: '9988776656', address: '3, Residency Road, Bengaluru', facility: 'Pratiti' }])
  const [a] = await ins('admissions', [{ patient_id: p.id, admission_type: 'Independent', sub_category: 'Independent', admission_date: adm, discharge_date: disc, discharge_reason: 'Capacity Regained', status: 'Discharged', admitted_by: 'Kavitha Menon' }])
  for (let i = 1; i <= 3; i++) {
    const d = addDays(adm, i * 14)
    if (d <= disc) await ins('capacity_assessments', [{ patient_id: p.id, admission_id: a.id, assessment_date: d, assessed_by: 'Arjun Sathe', result: 'Pass', notes: `Assessment ${i} — capacity confirmed.`, next_assessment_due: addDays(d, 14) }])
  }
  await notif([{ patient_id: p.id, type: 'Discharge', message: `${p.full_name} (${c}) discharged — capacity regained`, due_date: disc, is_read: true }])
  console.log(`✅ PT5 Discharged: ${p.full_name} (${c}) — admitted ${adm}, discharged ${disc}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// PT6 — CHS >90 days, admitted 130 days ago
// Full history: 4 HS weekly CAs + fortnightly CHS CAs from day 31 to today.
// Shifted HS→CHS>30 on day 31, CHS>30→CHS>90 on day 121.
// ─────────────────────────────────────────────────────────────────────────────
{
  const adm = ago(130), c = code()
  const [p] = await ins('patients', [{ patient_code: c, full_name: 'Suresh Menon', date_of_birth: '1970-03-18', gender: 'Male', phone: '9123456789', treating_doctor: 'Dr. Anand Krishnan', emergency_contact_name: 'Geetha Menon', emergency_contact_phone: '9123456790', address: '11, Pali Hill, Mumbai', facility: 'Pratiti' }])
  const [a] = await ins('admissions', [{ patient_id: p.id, admission_type: 'High Support', sub_category: 'CHS >90 days', admission_date: adm, status: 'Active', admitted_by: 'Arjun Sathe' }])
  // 4 weekly HS CAs
  for (let w = 1; w <= 4; w++) {
    const d = addDays(adm, w * 7)
    await ins('capacity_assessments', [{ patient_id: p.id, admission_id: a.id, assessment_date: d, assessed_by: 'Dr. Anand Krishnan', result: 'Fail', notes: `HS Week ${w}`, next_assessment_due: addDays(d, 7) }])
  }
  // Fortnightly CHS CAs from day 45 up to today
  let caDate = addDays(adm, 45); let caIdx = 1
  while (caDate <= TODAY) {
    await ins('capacity_assessments', [{ patient_id: p.id, admission_id: a.id, assessment_date: caDate, assessed_by: 'Dr. Anand Krishnan', result: 'Fail', notes: `CHS fortnightly #${caIdx}`, next_assessment_due: addDays(caDate, 14) }])
    caDate = addDays(caDate, 14); caIdx++
  }
  // Transfers
  await ins('transfers', [
    { patient_id: p.id, from_admission_id: a.id, to_admission_id: a.id, transfer_date: addDays(adm, 31), from_type: 'HS ≤30 days', to_type: 'CHS >30 days', reason: 'Capacity not regained after 30 days', triggered_by: 'System' },
    { patient_id: p.id, from_admission_id: a.id, to_admission_id: a.id, transfer_date: addDays(adm, 121), from_type: 'CHS >30 days', to_type: 'CHS >90 days', reason: 'Milestone reached — day 120', triggered_by: 'System' },
  ])
  await ins('clinical_notes', [{ patient_id: p.id, admission_id: a.id, note_date: addDays(adm, 10), author: 'Dr. Anand Krishnan', note_type: 'Clinical', content: 'Patient unresponsive to verbal prompts. Long-term care plan initiated.' }])
  // Upcoming CHS CAs
  let next = caDate; let i = caIdx
  const limit = addDays(adm, 240)
  while (next <= limit) {
    await notif([{ patient_id: p.id, type: 'Assessment Due', message: `CHS fortnightly CA #${i} due for ${p.full_name} (${c})`, due_date: next, is_read: false }])
    next = addDays(next, 14); i++
  }
  await notif([{ patient_id: p.id, type: 'Sub-Category Shift', message: `${p.full_name} (${c}) reaches day 240 — review for shift to CHS >120 days`, due_date: addDays(adm, 240), is_read: false }])
  console.log(`✅ PT6 CHS >90 days: ${p.full_name} (${c}) — admitted ${adm}, last CA ${addDays(caDate,-14)}, next CA ${caDate}`)
}

console.log('\n🎉 Seed complete. Refresh the app.')
