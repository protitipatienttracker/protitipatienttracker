'use client'
import { useRef, useState } from 'react'
import { Upload, CheckCircle2, XCircle, AlertTriangle, Download, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DOCTORS } from '@/lib/data'

export interface BulkPatientRow {
  full_name: string
  date_of_birth: string       // YYYY-MM-DD
  gender: string
  diagnosis: string
  treating_doctor: string
  admission_date: string      // YYYY-MM-DD
  admission_type: string      // Independent | High Support | Minor
  address: string
  phone: string
  emergency_contact_name: string
  emergency_contact_phone: string
  admitted_by: string
  assessment_date: string     // YYYY-MM-DD, blank for Minor
  assessed_by: string
  assessment_notes: string
}

interface ParsedRow extends BulkPatientRow {
  _rowNum: number
  _errors: string[]
}

const REQUIRED_HEADERS = [
  'full_name', 'date_of_birth', 'gender', 'treating_doctor',
  'admission_date', 'admission_type',
]

const TEMPLATE_HEADERS = [
  'full_name', 'date_of_birth', 'gender', 'diagnosis',
  'treating_doctor', 'admission_date', 'admission_type',
  'address', 'phone', 'emergency_contact_name', 'emergency_contact_phone',
  'admitted_by', 'assessment_date', 'assessed_by', 'assessment_notes',
]

const SAMPLE_ROWS = [
  [
    'Rahul Sharma', '1985-06-15', 'Male', 'Schizophrenia',
    DOCTORS[0], new Date().toISOString().split('T')[0], 'High Support',
    '12 MG Road, Kochi', '9876543210', 'Priya Sharma', '9876543211',
    'Admin', new Date().toISOString().split('T')[0], DOCTORS[0], 'Initial assessment on admission',
  ],
  [
    'Meena Nair', '1990-03-22', 'Female', 'Bipolar Disorder',
    DOCTORS[1], new Date().toISOString().split('T')[0], 'Independent',
    '45 Park Street, Thrissur', '9123456789', 'Suresh Nair', '9123456780',
    'Admin', new Date().toISOString().split('T')[0], DOCTORS[1], '',
  ],
  [
    'Arjun Pillai', '2010-11-05', 'Male', 'ADHD',
    DOCTORS[0], new Date().toISOString().split('T')[0], 'Minor',
    '', '', 'Latha Pillai', '9988776655',
    '', '', '', '',
  ],
]

function downloadTemplate() {
  const rows = [TEMPLATE_HEADERS, ...SAMPLE_ROWS]
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'pratiti_bulk_upload_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { cell += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      row.push(cell.trim()); cell = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim()); cell = ''
      if (row.some(c => c)) rows.push(row)
      row = []
    } else {
      cell += ch
    }
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(c => c)) rows.push(row) }
  return rows
}

function validateRow(raw: Record<string, string>, rowNum: number): ParsedRow {
  const errors: string[] = []
  const get = (k: string) => (raw[k] ?? '').trim()

  const full_name = get('full_name')
  const date_of_birth = get('date_of_birth')
  const gender = get('gender')
  const treating_doctor = get('treating_doctor')
  const admission_date = get('admission_date')
  const admission_type = get('admission_type')
  const assessment_date = get('assessment_date')
  const assessed_by = get('assessed_by')

  if (!full_name) errors.push('full_name required')
  if (!date_of_birth || isNaN(Date.parse(date_of_birth))) errors.push('date_of_birth invalid (use YYYY-MM-DD)')
  if (!['Male', 'Female', 'Other'].includes(gender)) errors.push('gender must be Male / Female / Other')
  if (!treating_doctor) errors.push('treating_doctor required')
  if (!admission_date || isNaN(Date.parse(admission_date))) errors.push('admission_date invalid (use YYYY-MM-DD)')
  if (!['Independent', 'High Support', 'Minor'].includes(admission_type)) errors.push('admission_type must be Independent / High Support / Minor')

  // Age vs Minor check
  if (date_of_birth && admission_date && !isNaN(Date.parse(date_of_birth)) && !isNaN(Date.parse(admission_date))) {
    const dob = new Date(date_of_birth)
    const adm = new Date(admission_date)
    let age = adm.getFullYear() - dob.getFullYear()
    if (adm.getMonth() < dob.getMonth() || (adm.getMonth() === dob.getMonth() && adm.getDate() < dob.getDate())) age--
    if (age < 18 && admission_type !== 'Minor') errors.push('Patient under 18 must be Minor')
    if (age >= 18 && admission_type === 'Minor') errors.push('Patient 18+ cannot be Minor')
  }

  if (admission_type !== 'Minor') {
    if (!assessment_date || isNaN(Date.parse(assessment_date))) errors.push('assessment_date required for non-Minor (YYYY-MM-DD)')
    if (!assessed_by) errors.push('assessed_by required for non-Minor')
  }

  return {
    full_name, date_of_birth, gender,
    diagnosis: get('diagnosis'),
    treating_doctor, admission_date, admission_type,
    address: get('address'),
    phone: get('phone'),
    emergency_contact_name: get('emergency_contact_name'),
    emergency_contact_phone: get('emergency_contact_phone'),
    admitted_by: get('admitted_by'),
    assessment_date, assessed_by,
    assessment_notes: get('assessment_notes'),
    _rowNum: rowNum,
    _errors: errors,
  }
}

interface Props {
  onSubmitBulk: (rows: BulkPatientRow[]) => Promise<void>
}

export default function BulkUpload({ onSubmitBulk }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  function processFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const all = parseCSV(text)
      if (all.length < 2) return
      const headers = all[0].map(h => h.toLowerCase().replace(/\s+/g, '_'))
      const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h))
      if (missing.length) {
        alert(`CSV is missing required columns: ${missing.join(', ')}`)
        return
      }
      const parsed = all.slice(1).map((r, i) => {
        const raw: Record<string, string> = {}
        headers.forEach((h, j) => { raw[h] = r[j] ?? '' })
        return validateRow(raw, i + 2)
      })
      setRows(parsed)
      setDone(false)
      setProgress(0)
    }
    reader.readAsText(file)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const validRows = rows.filter(r => r._errors.length === 0)
  const errorRows = rows.filter(r => r._errors.length > 0)

  async function handleSubmit() {
    if (!validRows.length) return
    setSubmitting(true)
    setProgress(0)
    for (let i = 0; i < validRows.length; i++) {
      await onSubmitBulk([validRows[i]])
      setProgress(i + 1)
    }
    setSubmitting(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-16 gap-4">
        <div className="w-16 h-16 rounded-full bg-[#34C759]/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-[#34C759]" />
        </div>
        <p className="text-[17px] font-semibold text-[#000000]">{validRows.length} patients admitted</p>
        <p className="text-[13px] text-[#8E8E93]">All valid rows have been processed successfully.</p>
        <button onClick={() => { setRows([]); setDone(false) }}
          className="mt-2 px-5 py-2.5 bg-[#007AFF] text-white rounded-xl text-[14px] font-medium active:opacity-80">
          Upload Another File
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Template download */}
      <div className="flex items-center justify-between p-4 bg-[#F2F2F7] rounded-2xl">
        <div>
          <p className="text-[14px] font-semibold text-[#000000]">Download CSV Template</p>
          <p className="text-[12px] text-[#8E8E93] mt-0.5">Fill in the template and upload it below</p>
        </div>
        <button onClick={downloadTemplate}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-[#E5E5EA] rounded-xl text-[13px] font-medium text-[#007AFF] active:opacity-70">
          <Download className="w-4 h-4" /> Template
        </button>
      </div>

      {/* Column guide */}
      <div className="p-4 bg-[#F2F2F7] rounded-2xl space-y-2">
        <p className="text-[13px] font-semibold text-[#000000]">Required CSV Columns</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
          {[
            ['full_name', 'Patient full name'],
            ['date_of_birth', 'YYYY-MM-DD format'],
            ['gender', 'Male / Female / Other'],
            ['treating_doctor', 'Doctor\'s full name'],
            ['admission_date', 'YYYY-MM-DD format'],
            ['admission_type', 'Independent / High Support / Minor'],
            ['diagnosis', 'Optional — primary diagnosis'],
            ['address', 'Optional'],
            ['phone', 'Optional'],
            ['emergency_contact_name', 'Optional'],
            ['emergency_contact_phone', 'Optional'],
            ['admitted_by', 'Optional — staff name'],
            ['assessment_date', 'YYYY-MM-DD — required if not Minor'],
            ['assessed_by', 'Doctor name — required if not Minor'],
            ['assessment_notes', 'Optional'],
          ].map(([col, desc]) => (
            <div key={col} className="flex gap-2">
              <span className="font-mono text-[#007AFF] shrink-0">{col}</span>
              <span className="text-[#8E8E93]">— {desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-3 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-colors',
          dragOver ? 'border-[#007AFF] bg-[#007AFF]/5' : 'border-[#C7C7CC] bg-[#F9F9F9] hover:border-[#007AFF]/50'
        )}
      >
        <Upload className={cn('w-8 h-8', dragOver ? 'text-[#007AFF]' : 'text-[#C7C7CC]')} />
        <p className="text-[14px] font-medium text-[#3A3A3C]">Drop CSV here or click to browse</p>
        <p className="text-[12px] text-[#8E8E93]">.csv files only</p>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-[#000000]">{rows.length} rows parsed</span>
            {validRows.length > 0 && (
              <span className="px-2 py-0.5 bg-[#34C759]/10 text-[#34C759] rounded-full text-[11px] font-semibold">
                {validRows.length} valid
              </span>
            )}
            {errorRows.length > 0 && (
              <span className="px-2 py-0.5 bg-[#FF3B30]/10 text-[#FF3B30] rounded-full text-[11px] font-semibold">
                {errorRows.length} errors
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-[rgba(60,60,67,0.12)] overflow-hidden">
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#F2F2F7] sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-[#8E8E93] font-medium w-8">Row</th>
                    <th className="px-3 py-2 text-left text-[#8E8E93] font-medium">Name</th>
                    <th className="px-3 py-2 text-left text-[#8E8E93] font-medium">DOB</th>
                    <th className="px-3 py-2 text-left text-[#8E8E93] font-medium">Type</th>
                    <th className="px-3 py-2 text-left text-[#8E8E93] font-medium">Doctor</th>
                    <th className="px-3 py-2 text-left text-[#8E8E93] font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r._rowNum} className={cn('border-t border-[rgba(60,60,67,0.06)]', r._errors.length ? 'bg-[#FF3B30]/3' : '')}>
                      <td className="px-3 py-2 text-[#8E8E93]">{r._rowNum}</td>
                      <td className="px-3 py-2 font-medium text-[#000000]">{r.full_name || '—'}</td>
                      <td className="px-3 py-2 text-[#3A3A3C]">{r.date_of_birth || '—'}</td>
                      <td className="px-3 py-2 text-[#3A3A3C]">{r.admission_type || '—'}</td>
                      <td className="px-3 py-2 text-[#3A3A3C]">{r.treating_doctor || '—'}</td>
                      <td className="px-3 py-2">
                        {r._errors.length === 0 ? (
                          <span className="flex items-center gap-1 text-[#34C759]"><CheckCircle2 className="w-3.5 h-3.5" />Valid</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[#FF3B30]" title={r._errors.join('; ')}>
                            <XCircle className="w-3.5 h-3.5" />{r._errors[0]}{r._errors.length > 1 ? ` +${r._errors.length - 1}` : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {errorRows.length > 0 && (
            <div className="flex items-start gap-2.5 p-3 bg-[#FF9500]/10 rounded-2xl">
              <AlertTriangle className="w-4 h-4 text-[#FF9500] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#FF9500]">
                {errorRows.length} row{errorRows.length > 1 ? 's' : ''} with errors will be skipped.
                Fix them in your CSV and re-upload to include them.
              </p>
            </div>
          )}

          {submitting && (
            <div className="flex items-center gap-3 p-4 bg-[#007AFF]/8 rounded-2xl">
              <Loader2 className="w-4 h-4 text-[#007AFF] animate-spin shrink-0" />
              <div className="flex-1">
                <p className="text-[13px] font-medium text-[#007AFF]">Admitting patients… {progress} / {validRows.length}</p>
                <div className="mt-1.5 h-1.5 bg-[#007AFF]/20 rounded-full overflow-hidden">
                  <div className="h-full bg-[#007AFF] rounded-full transition-all duration-300"
                    style={{ width: `${(progress / validRows.length) * 100}%` }} />
                </div>
              </div>
            </div>
          )}

          {!submitting && validRows.length > 0 && (
            <button onClick={handleSubmit}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#007AFF] text-white rounded-xl text-[14px] font-semibold active:opacity-80">
              <CheckCircle2 className="w-4 h-4" />
              Admit {validRows.length} Patient{validRows.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
