import type { CallSession } from '../types'

function stripHtml(html: string | null) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}

function callDuration(started: string | null, ended: string | null) {
  if (!started || !ended) return ''
  const ms = new Date(ended).getTime() - new Date(started).getTime()
  if (ms < 0) return ''
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}

export function callsToCsv(calls: CallSession[]) {
  const header = [
    'Call ID',
    'Date',
    'Ambulance',
    'Paramedic',
    'Doctor',
    'Priority',
    'Status',
    'Patient Info',
    'Duration',
    'Prescription',
  ].join(',')

  const rows = calls.map((c) =>
    [
      String(c.id),
      formatDate(c.ended_at ?? c.created_at),
      c.ambulance?.vehicle_id ?? '',
      c.ambulance?.paramedic_name ?? '',
      c.doctor?.full_name ?? '',
      c.priority,
      c.status,
      csvEscape(c.patient_info ?? ''),
      callDuration(c.started_at, c.ended_at),
      csvEscape(stripHtml(c.notes)),
    ].join(','),
  )

  return [header, ...rows].join('\n')
}

export function downloadCsv(calls: CallSession[], filename = 'call-history.csv') {
  const csv = callsToCsv(calls)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export { stripHtml, formatDate, callDuration }
