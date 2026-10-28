import { localeConfig } from "@/config/locale"

/**
 * Поля ввода date/time работают со «стенным» временем. Для API его нужно перевести
 * в ISO 8601 с учётом часового пояса компании, а не браузера.
 */

const { timeZone } = localeConfig

function partsIn(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  const offset = get("timeZoneName").replace("GMT", "") || "+00:00"
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}`, offset }
}

/** "2026-10-28T10:00" (время компании) → "2026-10-28T10:00:00+06:00" */
export function companyWallTimeToIso(value: string): string {
  // Смещение берём на эту дату: в поясах с переходом на летнее время оно меняется
  const { offset } = partsIn(new Date(`${value}:00Z`))
  return `${value}:00${offset}`
}

/** ISO-дата-время → значение для <input type="datetime-local"> во времени компании */
export function isoToCompanyWallTime(iso: string): string {
  const { date, time } = partsIn(new Date(iso))
  return `${date}T${time}`
}

/** Дата YYYY-MM-DD в часовом поясе компании — для группировки списков по дням */
export function companyDateOf(iso: string): string {
  return partsIn(new Date(iso)).date
}
