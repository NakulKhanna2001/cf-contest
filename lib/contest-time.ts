const CONTEST_TIME_ZONE = 'Asia/Kolkata'

type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function getTimeZoneParts(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getTimeZoneParts(date, timeZone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )

  return asUtc - date.getTime()
}

function zonedDateTimeToUtc(
  dateParts: Omit<DateParts, 'second'> & { second?: number },
  timeZone: string
): Date {
  const utcGuess = new Date(
    Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      dateParts.hour,
      dateParts.minute,
      dateParts.second ?? 0
    )
  )
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone)
  return new Date(utcGuess.getTime() - offset)
}

export function getTodayContestWindow(now = new Date()) {
  const today = getTimeZoneParts(now, CONTEST_TIME_ZONE)
  const startTime = zonedDateTimeToUtc(
    {
      year: today.year,
      month: today.month,
      day: today.day,
      hour: 21,
      minute: 30,
    },
    CONTEST_TIME_ZONE
  )
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)
  const registrationClosesAt = new Date(startTime.getTime() - 5 * 60 * 1000)

  const dayStartUtc = zonedDateTimeToUtc(
    {
      year: today.year,
      month: today.month,
      day: today.day,
      hour: 0,
      minute: 0,
    },
    CONTEST_TIME_ZONE
  )
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000)

  return {
    startTime,
    endTime,
    registrationClosesAt,
    dayStartUtc,
    dayEndUtc,
  }
}

export function getContestStatus(now: Date, startTime: Date, endTime: Date) {
  if (now >= endTime) return 'ENDED'
  if (now >= startTime) return 'ACTIVE'
  return 'PENDING'
}

export function formatInIst(date: Date | string, options?: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleString('en-IN', {
    timeZone: CONTEST_TIME_ZONE,
    ...options,
  })
}

export { CONTEST_TIME_ZONE }
