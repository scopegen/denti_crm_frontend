const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "28 Sep 2026". A plain date ("2026-09-28") is shown as is; a moment in time is shown in
 * the clinic's time zone, so every staff member sees the same day.
 */
export function formatDate(value: string, timeZone = 'Asia/Kolkata'): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return `${day} ${MONTHS[month - 1]} ${year}`
  }
  // A moment in time: find its calendar day in the clinic's time zone, then format it the same way.
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(value)).split('-').map(Number)
  return `${day} ${MONTHS[month - 1]} ${year}`
}

/** "10:05 AM" in the clinic's time zone. */
export function formatTime(value: string, timeZone = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone })
    .format(new Date(value))
    .toUpperCase()
}

/** "10:30 AM" from a plain "10:30:00" time of day. */
export function formatTimeOfDay(value: string): string {
  const [h, m] = value.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** "Monday, 28 September" for a plain "2026-09-28". */
export function formatLongDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}

/** Today's date in the clinic's time zone, as "2026-09-28". */
export function todayInZone(timeZone = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
}
