import { localeConfig } from "@/config/locale"

const { locale, currencyLabel, timeZone } = localeConfig

const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
const decimalFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
const signedIntegerFormat = new Intl.NumberFormat(locale, {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
})
const compactFormat = new Intl.NumberFormat(locale, {
  notation: "compact",
  maximumFractionDigits: 1,
})
const percentFormat = new Intl.NumberFormat(locale, {
  style: "percent",
  maximumFractionDigits: 1,
})
const signedPercentFormat = new Intl.NumberFormat(locale, {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
})
const signedDecimalFormat = new Intl.NumberFormat(locale, {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
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

/** 1 250 000 сом */
export function formatMoney(value: number): string {
  return `${numberFormat.format(value)} ${currencyLabel}`
}

/** 1,3 млн сом — для осей графиков и плотных мест */
export function formatMoneyCompact(value: number): string {
  return `${compactFormat.format(value)} ${currencyLabel}`
}

/** 9,1 млн — без валюты, для осей графиков */
export function formatCompactNumber(value: number): string {
  return compactFormat.format(value)
}

/** Принимает долю (0.234) и возвращает «23,4 %» */
export function formatPercent(ratio: number): string {
  return percentFormat.format(ratio)
}

/** Относительное изменение со знаком: «+8,6 %» */
export function formatSignedPercent(ratio: number): string {
  return signedPercentFormat.format(ratio)
}

/** Изменение доли в процентных пунктах: 0.231 → 0.248 даёт «−1,7 п. п.» */
export function formatPointsDelta(ratioDelta: number): string {
  return `${signedDecimalFormat.format(ratioDelta * 100)} п. п.`
}

/** «27 окт.» — принимает дату ISO (YYYY-MM-DD) или дату-время */
export function formatDayMonth(isoDate: string): string {
  return dayMonthFormat.format(new Date(isoDate))
}

/** «14:30» в часовом поясе компании */
export function formatTime(isoDateTime: string): string {
  return timeFormat.format(new Date(isoDateTime))
}
