import { TimeInterval } from '../types'

export interface DateRange {
  startDate: string
  endDate: string
}

export function resolveDateRange(
  timeInterval: string,
  startDate?: string,
  endDate?: string,
): DateRange {
  const now = new Date()

  const startOf = (d: Date) => {
    const s = new Date(d)
    s.setHours(0, 0, 0, 0)
    return s
  }
  const endOf = (d: Date) => {
    const e = new Date(d)
    e.setHours(23, 59, 59, 999)
    return e
  }

  switch (timeInterval) {
    case TimeInterval.TODAY:
      return { startDate: startOf(now).toISOString(), endDate: endOf(now).toISOString() }

    case TimeInterval.YESTERDAY: {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      return { startDate: startOf(y).toISOString(), endDate: endOf(y).toISOString() }
    }

    case TimeInterval.THIS_WEEK: {
      const day = now.getDay()
      const start = new Date(now)
      start.setDate(now.getDate() - day)
      return { startDate: startOf(start).toISOString(), endDate: endOf(now).toISOString() }
    }

    case TimeInterval.LAST_WEEK: {
      const day = now.getDay()
      const end = new Date(now)
      end.setDate(now.getDate() - day - 1)
      const start = new Date(end)
      start.setDate(end.getDate() - 6)
      return { startDate: startOf(start).toISOString(), endDate: endOf(end).toISOString() }
    }

    case TimeInterval.THIS_MONTH: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { startDate: startOf(start).toISOString(), endDate: endOf(now).toISOString() }
    }

    case TimeInterval.LAST_MONTH: {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { startDate: startOf(start).toISOString(), endDate: endOf(end).toISOString() }
    }

    case TimeInterval.THIS_YEAR: {
      const start = new Date(now.getFullYear(), 0, 1)
      return { startDate: startOf(start).toISOString(), endDate: endOf(now).toISOString() }
    }

    case TimeInterval.LAST_YEAR: {
      const start = new Date(now.getFullYear() - 1, 0, 1)
      const end = new Date(now.getFullYear() - 1, 11, 31)
      return { startDate: startOf(start).toISOString(), endDate: endOf(end).toISOString() }
    }

    case TimeInterval.PREVIOUS_30_DAYS: {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return { startDate: startOf(start).toISOString(), endDate: endOf(now).toISOString() }
    }

    case TimeInterval.SPECIFIC_RANGE:
      if (!startDate || !endDate) throw new Error('startDate and endDate required for SPECIFIC_RANGE')
      return { startDate, endDate }

    default:
      // ALL — return very wide range
      return {
        startDate: new Date(2020, 0, 1).toISOString(),
        endDate: endOf(now).toISOString(),
      }
  }
}
