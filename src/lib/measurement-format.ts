export function formatMeasurement(value: unknown, digits = 3): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '-'
  const formatter = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  const smallest = 10 ** -digits
  if (value > 0 && value < smallest) return `< ${formatter.format(smallest)}`
  return formatter.format(value)
}

export function formatConfidence(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return '-'
  return `${formatMeasurement(value * 100, 1)}%`
}

export function formatSourceTimestamp(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Tidak tersedia'
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium', timeStyle: 'long', timeZone: 'UTC',
  })
}
