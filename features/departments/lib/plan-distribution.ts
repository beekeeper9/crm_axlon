/**
 * Распределение плана компании между отделами — только арифметика над целями,
 * которые ввёл директор (никаких формул распределения: части задаёт он сам).
 */

/** Месячные метрики плана: количество продаж и деньги (оборот) */
export const PLAN_METRICS = ["monthly_sales", "monthly_turnover"] as const
export type PlanMetricKey = (typeof PLAN_METRICS)[number]

/** Валюты денежного плана; валюта компании подставляется первой */
export const PLAN_CURRENCIES = ["KGS", "USD", "EUR", "RUB", "KZT", "UZS"] as const

export function currencyOptions(companyCurrency: string): string[] {
  return [companyCurrency, ...PLAN_CURRENCIES.filter((code) => code !== companyCurrency)]
}

/** Десятичная строка цели из ввода: пробелы убираются, запятая — точка; null — не число */
export function parseTarget(input: string): string | null {
  const value = input.trim().replace(/\s/g, "").replace(",", ".")
  if (value === "") return null
  return /^\d{1,13}(\.\d{1,2})?$/.test(value) ? value : null
}

/** Сумма в копейках/тыйынах, чтобы сравнивать без ошибок плавающей точки */
export function toCents(value: string): number {
  const [whole, fraction = ""] = value.split(".")
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2))
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : ""
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const fraction = abs % 100
  return fraction === 0 ? `${sign}${whole}` : `${sign}${whole}.${String(fraction).padStart(2, "0")}`
}

export type DistributionStatus = {
  /** Сколько распределено по отделам */
  distributed: string
  /** Сколько осталось распределить (отрицательное — распределено больше плана) */
  remaining: string
  /** Части в сумме равны плану компании */
  isExact: boolean
}

/** Итог распределения: сумма частей против плана компании */
export function distributionStatus(companyTarget: string, parts: readonly string[]): DistributionStatus {
  const total = parts.reduce((sum, part) => sum + toCents(part), 0)
  const remaining = toCents(companyTarget) - total
  return { distributed: fromCents(total), remaining: fromCents(remaining), isExact: remaining === 0 }
}

export type MetricParts = {
  metric: PlanMetricKey
  /** Только для денег: новая валюта плана компании и всех отделов на этот месяц */
  currency?: string
  parts: readonly { departmentId: string; target: string }[]
}

/**
 * Тело `POST /plans/distribute/`: все показатели одним запросом (backend сохраняет их в одной
 * транзакции). null — доля отдела не число.
 */
export function distributionBody(input: { period: string; distributions: readonly MetricParts[] }) {
  const distributions = input.distributions.map((item) => ({
    metric: item.metric,
    ...(item.metric === "monthly_turnover" && item.currency ? { currency: item.currency } : {}),
    parts: item.parts.map((part) => ({ departmentId: part.departmentId, target: parseTarget(part.target === "" ? "0" : part.target) })),
  }))
  if (distributions.some((item) => item.parts.some((part) => part.target === null))) return null
  return { period: input.period, distributions }
}
