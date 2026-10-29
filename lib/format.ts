import { localeConfig } from "@/config/locale"

const { locale, timeZone } = localeConfig

const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
const decimalFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
const signedIntegerFormat = new Intl.NumberFormat(locale, {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
})
const percentFormat = new Intl.NumberFormat(locale, {
  style: "percent",
  maximumFractionDigits: 1,
})
const dayMonthFormat = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "short",
  timeZone,
})
const timeFormat = new Intl.DateTimeFormat(locale, {
  hour: "2-digit",
  minute: "2-digit",
  timeZone,
})

/** «Айбек Садыков» → «АС» — для аватаров без фото */
export function formatInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/** «+340 000» / «−12 000» */
export function formatSignedNumber(value: number): string {
  return signedIntegerFormat.format(value)
}

/** 7,4 — один знак после запятой */
export function formatDecimal(value: number): string {
  return decimalFormat.format(value)
}

/** Принимает долю (0.234) и возвращает «23,4 %» */
export function formatPercent(ratio: number): string {
  return percentFormat.format(ratio)
}

/** «27 окт.» — принимает дату ISO (YYYY-MM-DD) или дату-время */
export function formatDayMonth(isoDate: string): string {
  return dayMonthFormat.format(new Date(isoDate))
}

/** «14:30» в часовом поясе компании */
export function formatTime(isoDateTime: string): string {
  return timeFormat.format(new Date(isoDateTime))
}

const CURRENCY_LABELS: Record<string, string> = { KGS: "сом", RUB: "₽", KZT: "₸", USD: "$", EUR: "€" }
const decimalMoneyFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
const dateTimeFormat = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone,
})
const weekdayDateFormat = new Intl.DateTimeFormat(locale, {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone,
})
const fullDateFormat = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone,
})

/**
 * Сумма из API: десятичная строка и ISO-код валюты («1500.00», "KGS» → «1 500 сом»).
 * Intl форматирует строку как точное десятичное число — без перевода во float.
 */
export function formatDecimalMoney(amount: string, currency: string): string {
  // Intl.NumberFormat принимает десятичную строку (ES2023), типы TS этого пока не знают
  const formatted = decimalMoneyFormat.format(amount as unknown as number)
  return `${formatted} ${CURRENCY_LABELS[currency] ?? currency}`
}

/** «27 окт., 14:30» */
export function formatDateTime(isoDateTime: string): string {
  return dateTimeFormat.format(new Date(isoDateTime))
}

/** «вторник, 27 октября» — заголовки дней в списках */
export function formatWeekdayDate(isoDate: string): string {
  return weekdayDateFormat.format(new Date(isoDate))
}

/** «27 октября 2026 г.» */
export function formatFullDate(isoDate: string): string {
  return fullDateFormat.format(new Date(isoDate))
}

/** Длительность звонка: 185 → «3:05» */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds % 60)
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

const pluralRules = new Intl.PluralRules(locale)

/** Склонение по числу: pluralize(3, ["встреча", "встречи", "встреч"]) → «встречи» */
export function pluralize(count: number, [one, few, many]: readonly [string, string, string]): string {
  const rule = pluralRules.select(count)
  return rule === "one" ? one : rule === "few" ? few : many
}

const compactFormat = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 })

/** «1,3 млн» — для осей графиков */
export function formatCompactNumber(value: number): string {
  return compactFormat.format(value)
}
