// Datumsfunktionen für den Wochenplan. Gerechnet wird immer in lokaler Zeit,
// gespeichert als "YYYY-MM-DD" (ohne Uhrzeit, damit es keine Zeitzonen-Verschiebungen gibt).

/** Date → "2026-11-03" */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "2026-11-03" → Date (lokal, 00:00 Uhr); ungültig → null */
export function parseISODate(text: string | null): Date | null {
  const match = text?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** Montag der Woche, in der `date` liegt. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = (result.getDay() + 6) % 7 // Mo = 0 … So = 6
  return addDays(result, -weekday)
}

/** ISO-Kalenderwoche (KW), wie in Deutschland üblich. */
export function isoWeek(date: Date): number {
  const thursday = addDays(startOfWeek(date), 3)
  const firstThursday = addDays(startOfWeek(new Date(thursday.getFullYear(), 0, 4)), 3)
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000))
}

const weekdayFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'long' })
const shortDateFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' })

/** "Montag" */
export function weekdayName(date: Date): string {
  return weekdayFormat.format(date)
}

/** "3. Nov." */
export function shortDate(date: Date): string {
  return shortDateFormat.format(date)
}

/** "3. – 9. Nov." bzw. "27. Okt. – 2. Nov." */
export function weekRange(monday: Date): string {
  const sunday = addDays(monday, 6)
  if (monday.getMonth() === sunday.getMonth()) return `${monday.getDate()}. – ${shortDate(sunday)}`
  return `${shortDate(monday)} – ${shortDate(sunday)}`
}
