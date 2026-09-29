/** A planning period: a week, half a week, or any number of days. */
export interface Period {
  id: string
  /** ISO date, YYYY-MM-DD (local). */
  start: string
  days: number
  mealsPerDay: number
  name?: string
}

export const LENGTH_PRESETS = [
  { days: 3, label: '3 days' },
  { days: 4, label: '4 days' },
  { days: 7, label: 'Week' },
] as const

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

export const randomId = () => Math.random().toString(36).slice(2, 10)

export function newPeriod(opts: Partial<Omit<Period, 'id'>> = {}): Period {
  return { id: randomId(), start: opts.start ?? isoDate(new Date()), days: opts.days ?? 7, mealsPerDay: opts.mealsPerDay ?? 1, name: opts.name }
}

/** The period that follows `p` with the same shape. */
export function nextPeriod(p: Period): Period {
  const end = addDays(p.start, p.days)
  const today = isoDate(new Date())
  return newPeriod({ start: end > today ? end : today, days: p.days, mealsPerDay: p.mealsPerDay })
}

export const mealsTarget = (p: Period) => p.days * p.mealsPerDay
export const endDate = (p: Period) => addDays(p.start, p.days - 1)

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => parseDate(iso).toLocaleDateString(undefined, opts)

/** "Mon, Sep 29 – Sun, Oct 5" */
export function rangeLabel(p: Period): string {
  const o: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
  return p.days === 1 ? fmt(p.start, o) : `${fmt(p.start, o)} – ${fmt(endDate(p), o)}`
}

/** "Week of Sep 29", "4 days from Sep 29", or the custom name. */
export function periodTitle(p: Period): string {
  if (p.name) return p.name
  const d = fmt(p.start, { month: 'short', day: 'numeric' })
  return p.days === 7 ? `Week of ${d}` : `${p.days} days from ${d}`
}

/** Where today falls: before, during (day n of m), or after the period. */
export function periodStatus(p: Period, today = isoDate(new Date())): { state: 'upcoming' | 'current' | 'past'; day: number } {
  if (today < p.start) return { state: 'upcoming', day: 0 }
  const day = Math.round((parseDate(today).getTime() - parseDate(p.start).getTime()) / 86400000) + 1
  return day > p.days ? { state: 'past', day } : { state: 'current', day }
}
