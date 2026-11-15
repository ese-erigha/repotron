const SHORT_SHA_LENGTH = 7

const RELATIVE_UNITS = [
  { unit: 'day', milliseconds: 86_400_000 },
  { unit: 'hour', milliseconds: 3_600_000 },
  { unit: 'minute', milliseconds: 60_000 },
] as const

const JUST_NOW = 'just now'

const LOCALE = 'en-US'

const countFormat = new Intl.NumberFormat(LOCALE)
const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'always' })
const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' })
const secondsFormat = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Writes a count with a separator at each thousand, such as 1,204. */
export function formatCount(count: number): string {
  return countFormat.format(count)
}

/** Shortens a commit sha to the 7 characters that GitHub shows. */
export function shortSha(commitSha: string): string {
  return commitSha.slice(0, SHORT_SHA_LENGTH)
}

/** Writes the age of a time in its largest whole unit, such as "2 hours ago". */
export function formatRelativeTime(timestamp: number, now: number): string {
  const elapsed = now - timestamp
  const match = RELATIVE_UNITS.find((entry) => elapsed >= entry.milliseconds)
  if (!match) return JUST_NOW
  return relativeFormat.format(-Math.floor(elapsed / match.milliseconds), match.unit)
}

/** Writes a day, such as "Nov 14, 2026". */
export function formatDate(timestamp: number): string {
  return dateFormat.format(timestamp)
}

/** Writes a duration in seconds with one decimal, such as "2.4 s". */
export function formatSeconds(milliseconds: number): string {
  return `${secondsFormat.format(milliseconds / 1_000)} s`
}
