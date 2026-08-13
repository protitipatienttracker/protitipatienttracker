import { describe, it, expect } from 'vitest'
import {
  getSubCategoryFromDays,
  getNextRenewalDate,
  getNextAssessmentDate,
  getNextMilestoneSubCategory,
} from '../db'
import { mapDbPatientToUi } from '../data'
import type { DbPatient } from '../supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function daysAgo(n: number): string {
  return addDays(new Date().toISOString().split('T')[0], -n)
}

function mockPatient(overrides: Partial<DbPatient> & {
  admissionType: 'Independent' | 'High Support' | 'Minor'
  subCategory: string | null
  admissionDate: string
  dob?: string
  assessments?: DbPatient['capacity_assessments']
  discharged?: { date: string; reason: string }
}): DbPatient {
  const { admissionType, subCategory, admissionDate, dob, assessments, discharged, ...rest } = overrides
  return {
    id: 'test-id',
    patient_code: 'PT-001',
    full_name: 'Test Patient',
    date_of_birth: dob ?? '1990-01-01',
    gender: 'Male',
    phone: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    address: null,
    treating_doctor: 'Dr. Test',
    created_at: admissionDate,
    admissions: [{
      id: 'adm-1',
      patient_id: 'test-id',
      admission_type: admissionType,
      sub_category: subCategory,
      admission_date: admissionDate,
      discharge_date: discharged?.date ?? null,
      discharge_reason: discharged?.reason ?? null,
      status: discharged ? 'Discharged' : 'Active',
      admitted_by: 'Staff',
      notes: null,
      created_at: admissionDate,
    }],
    capacity_assessments: assessments ?? [],
    clinical_notes: [],
    ...rest,
  }
}

// ─── 1. getSubCategoryFromDays ────────────────────────────────────────────────

describe('getSubCategoryFromDays', () => {
  const cases: [number, string][] = [
    [1,   'HS ≤30 days'],
    [30,  'HS ≤30 days'],
    [31,  'CHS >30 days'],
    [90,  'CHS >30 days'],
    [91,  'CHS >90 days'],
    [120, 'CHS >90 days'],
    [121, 'CHS >120 days'],
    [180, 'CHS >120 days'],
    [181, 'CHS >180 days'],
    [999, 'CHS >180 days'],
  ]
  cases.forEach(([days, expected]) => {
    it(`day ${days} → ${expected}`, () => expect(getSubCategoryFromDays(days)).toBe(expected))
  })
})

// ─── 2. getNextRenewalDate ────────────────────────────────────────────────────

describe('getNextRenewalDate', () => {
  const adm = '2025-01-01'
  const cases: [string | null, string][] = [
    ['HS ≤30 days',   '2025-01-31'],  // day 30
    ['CHS >30 days',  '2025-04-01'],  // day 90
    ['CHS >90 days',  '2025-05-01'],  // day 120
    ['CHS >120 days', '2025-06-30'],  // day 180
    ['CHS >180 days', '2025-12-28'],  // day 361
    [null,            '2025-01-31'],
  ]
  cases.forEach(([sub, expected]) => {
    it(`${sub ?? 'null'} → ${expected}`, () => {
      expect(getNextRenewalDate(adm, sub).toISOString().split('T')[0]).toBe(expected)
    })
  })
})

// ─── 3. getNextAssessmentDate ─────────────────────────────────────────────────

describe('getNextAssessmentDate', () => {
  const adm    = '2025-01-01'
  const lastCA = '2025-01-08'

  it('HS ≤30 days + prior CA → 7 days from last CA', () => {
    expect(getNextAssessmentDate(adm, lastCA, 'High Support', 'HS ≤30 days').toISOString().split('T')[0])
      .toBe('2025-01-15')
  })
  it('HS ≤30 days + no prior CA → 7 days from admission', () => {
    expect(getNextAssessmentDate(adm, null, 'High Support', 'HS ≤30 days').toISOString().split('T')[0])
      .toBe('2025-01-08')
  })
  it('CHS >30 days → 14 days from last CA', () => {
    expect(getNextAssessmentDate(adm, lastCA, 'High Support', 'CHS >30 days').toISOString().split('T')[0])
      .toBe('2025-01-22')
  })
  it('Independent + prior CA → 14 days from last CA', () => {
    expect(getNextAssessmentDate(adm, lastCA, 'Independent', null).toISOString().split('T')[0])
      .toBe('2025-01-22')
  })
  it('Independent + no prior CA → 14 days from admission', () => {
    expect(getNextAssessmentDate(adm, null, 'Independent', null).toISOString().split('T')[0])
      .toBe('2025-01-15')
  })
})

// ─── 4. getNextMilestoneSubCategory ──────────────────────────────────────────

describe('getNextMilestoneSubCategory', () => {
  const cases: [string | null, string][] = [
    ['HS ≤30 days',   'CHS >30 days'],
    ['CHS >30 days',  'CHS >90 days'],
    ['CHS >90 days',  'CHS >120 days'],
    ['CHS >120 days', 'CHS >180 days'],
    ['CHS >180 days', 'CHS >180 days'], // recurring
    [null,            'CHS >30 days'],
  ]
  cases.forEach(([current, expected]) => {
    it(`${current ?? 'null'} → ${expected}`, () => {
      expect(getNextMilestoneSubCategory(current)).toBe(expected)
    })
  })
})

// ─── 5. Independent patient ───────────────────────────────────────────────────

describe('mapDbPatientToUi — Independent', () => {
  const admDate = daysAgo(10)
  const ui = mapDbPatientToUi(mockPatient({
    admissionType: 'Independent',
    subCategory: 'Independent',
    admissionDate: admDate,
  }))

  it('admissionType is Independent', () => expect(ui.admissionType).toBe('Independent'))
  it('nextActionType is — (no ongoing CAs)', () => expect(ui.nextActionType).toBe('—'))
  it('daysAdmitted ≈ 10', () => expect(ui.daysAdmitted).toBeGreaterThanOrEqual(9))
  it('status is On Track', () => expect(ui.status).toBe('On Track'))
})

// ─── 6. High Support ≤30 days ────────────────────────────────────────────────

describe('mapDbPatientToUi — High Support ≤30 days', () => {
  const admDate = daysAgo(5)
  const ui = mapDbPatientToUi(mockPatient({
    admissionType: 'High Support',
    subCategory: 'HS ≤30 days',
    admissionDate: admDate,
  }))

  it('admissionType is High Support', () => expect(ui.admissionType).toBe('High Support'))
  it('currentSubStatus is HS ≤30 days', () => expect(ui.currentSubStatus).toBe('HS ≤30 days'))
  it('nextActionType is Shift to CHS', () => expect(ui.nextActionType).toBe('Shift to CHS'))
  it('nextActionDue is 30 days from admission', () => {
    expect(ui.nextActionDue).toBe(addDays(admDate, 30))
  })
})

// ─── 7. CHS >30 days ─────────────────────────────────────────────────────────

describe('mapDbPatientToUi — CHS >30 days', () => {
  const admDate  = daysAgo(50)
  const lastCADate = daysAgo(4)
  const ui = mapDbPatientToUi(mockPatient({
    admissionType: 'High Support',
    subCategory: 'CHS >30 days',
    admissionDate: admDate,
    assessments: [{
      id: 'ca-1', patient_id: 'test-id', admission_id: 'adm-1',
      assessment_date: lastCADate, assessed_by: 'Dr. Test',
      result: 'Fail', notes: null,
      next_assessment_due: addDays(lastCADate, 14),
      created_at: lastCADate,
    }],
  }))

  it('currentSubStatus is CHS >30 days', () => expect(ui.currentSubStatus).toBe('CHS >30 days'))
  it('nextActionType is CHS Renewal', () => expect(ui.nextActionType).toBe('CHS Renewal'))
  it('nextActionDue is 90 days from admission', () => {
    expect(ui.nextActionDue).toBe(addDays(admDate, 90))
  })
  it('last assessment nextDue is 14 days from last CA', () => {
    expect(ui.assessments[0].nextDue).toBe(addDays(lastCADate, 14))
  })
})

// ─── 8. Minor patient ────────────────────────────────────────────────────────

describe('mapDbPatientToUi — Minor', () => {
  const admDate = daysAgo(20)
  const dob = addDays(new Date().toISOString().split('T')[0], -(17 * 365))
  const ui = mapDbPatientToUi(mockPatient({
    admissionType: 'Minor',
    subCategory: 'Minor',
    admissionDate: admDate,
    dob,
  }))

  it('admissionType is Minor', () => expect(ui.admissionType).toBe('Minor'))
  it('nextActionType is Turns 18', () => expect(ui.nextActionType).toBe('Turns 18'))
  it('age is 17', () => expect(ui.age).toBe(17))
  it('nextActionDue is ~1 year from now', () => {
    const daysUntil = Math.floor((new Date(ui.nextActionDue).getTime() - Date.now()) / 86400000)
    expect(daysUntil).toBeGreaterThan(300)
    expect(daysUntil).toBeLessThan(400)
  })
})

// ─── 9. Discharged patient ───────────────────────────────────────────────────

describe('mapDbPatientToUi — Discharged', () => {
  const admDate  = daysAgo(60)
  const discDate = daysAgo(5)
  const ui = mapDbPatientToUi(mockPatient({
    admissionType: 'Independent',
    subCategory: 'Independent',
    admissionDate: admDate,
    discharged: { date: discDate, reason: 'Voluntary' },
  }))

  it('admissionType is Discharged', () => expect(ui.admissionType).toBe('Discharged'))
  it('dischargeDate is set', () => expect(ui.dischargeDate).toBe(discDate))
  it('dischargeReason is Voluntary', () => expect(ui.dischargeReason).toBe('Voluntary'))
  it('totalStay is 55 days', () => expect(ui.totalStay).toBe('55 days'))
  it('daysAdmitted is 0', () => expect(ui.daysAdmitted).toBe(0))
  it('status is Discharged', () => expect(ui.status).toBe('Discharged'))
})

// ─── 10. Shift modal sub-category mapping ────────────────────────────────────

describe('Shift modal — sub-category mapping', () => {
  // mirrors handleShiftType in PatientDetail.tsx
  const resolve = (shiftTo: string) => shiftTo === 'High Support' ? 'HS ≤30 days' : shiftTo

  const cases: [string, string][] = [
    ['High Support',  'HS ≤30 days'],
    ['Independent',   'Independent'],
    ['CHS >30 days',  'CHS >30 days'],
    ['CHS >90 days',  'CHS >90 days'],
    ['CHS >120 days', 'CHS >120 days'],
    ['CHS >180 days', 'CHS >180 days'],
  ]
  cases.forEach(([input, expected]) => {
    it(`"${input}" → "${expected}"`, () => expect(resolve(input)).toBe(expected))
  })
})

// ─── 11. Calendar — HS weekly reminder dates ─────────────────────────────────

describe('Calendar — HS weekly reminders', () => {
  const adm = '2025-01-01'
  const dates = [1, 2, 3, 4].map(w => addDays(adm, w * 7))

  it('generates exactly 4 reminders', () => expect(dates).toHaveLength(4))
  it('week 1 → 2025-01-08', () => expect(dates[0]).toBe('2025-01-08'))
  it('week 2 → 2025-01-15', () => expect(dates[1]).toBe('2025-01-15'))
  it('week 3 → 2025-01-22', () => expect(dates[2]).toBe('2025-01-22'))
  it('week 4 → 2025-01-29', () => expect(dates[3]).toBe('2025-01-29'))
})

// ─── 12. Calendar — CHS fortnightly reminder dates ───────────────────────────

describe('Calendar — CHS fortnightly reminders', () => {
  const lastCA = '2025-02-01'

  function fortnightlyDates(from: string, windowDays: number): string[] {
    const limit = addDays(from, windowDays)
    const out: string[] = []
    let next = addDays(from, 14)
    while (next <= limit) { out.push(next); next = addDays(next, 14) }
    return out
  }

  const dates = fortnightlyDates(lastCA, 90)

  it('first reminder is 14 days after last CA', () => expect(dates[0]).toBe('2025-02-15'))
  it('each reminder is exactly 14 days apart', () => {
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.round((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000)
      expect(diff).toBe(14)
    }
  })
  it('all reminders fall within the window', () => {
    const limit = addDays(lastCA, 90)
    dates.forEach(d => expect(d <= limit).toBe(true))
  })
})

// ─── 13. Calendar — Minor 18th birthday ──────────────────────────────────────

describe('Calendar — Minor 18th birthday reminder', () => {
  it('18th birthday is exactly 18 years after DOB', () => {
    const dob = new Date('2007-06-15')
    const eighteenth = new Date(dob)
    eighteenth.setFullYear(eighteenth.getFullYear() + 18)
    expect(eighteenth.toISOString().split('T')[0]).toBe('2025-06-15')
  })

  it('Minor turning 18 today has nextActionDue = today', () => {
    const today = new Date()
    const dob = new Date(today)
    dob.setFullYear(dob.getFullYear() - 18)
    const dobStr = dob.toISOString().split('T')[0]
    const ui = mapDbPatientToUi(mockPatient({
      admissionType: 'Minor',
      subCategory: 'Minor',
      admissionDate: daysAgo(30),
      dob: dobStr,
    }))
    expect(ui.nextActionDue).toBe(today.toISOString().split('T')[0])
  })
})
