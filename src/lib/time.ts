const RELATIVE_TIME_UNITS = [
  { thresholdMs: 365 * 24 * 60 * 60 * 1000, label: 'y' },
  { thresholdMs: 30 * 24 * 60 * 60 * 1000, label: 'mo' },
  { thresholdMs: 7 * 24 * 60 * 60 * 1000, label: 'w' },
  { thresholdMs: 24 * 60 * 60 * 1000, label: 'd' },
  { thresholdMs: 60 * 60 * 1000, label: 'h' },
  { thresholdMs: 60 * 1000, label: 'm' },
  { thresholdMs: 1000, label: 's' },
] as const

export function formatRelativeTimestamp(value: string | null): string | null {
  if (value == null || value === '') {
    return null
  }

  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) {
    return null
  }

  const ageMs = Math.abs(Date.now() - timestamp.getTime())
  for (const unit of RELATIVE_TIME_UNITS) {
    if (ageMs >= unit.thresholdMs) {
      return `${Math.round(ageMs / unit.thresholdMs)}${unit.label}`
    }
  }

  return '0s'
}
