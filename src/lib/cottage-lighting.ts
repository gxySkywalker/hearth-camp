export type CottageLightPeriod = 'day' | 'night'

/** The cottage follows local wall-clock time: 06:00–17:59 day, otherwise night. */
export function getCottageLightPeriod(date = new Date()): CottageLightPeriod {
  const hour = date.getHours()
  return hour >= 6 && hour < 18 ? 'day' : 'night'
}
