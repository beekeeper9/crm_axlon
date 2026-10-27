import type { StatusTone } from "@/components/shared/status-badge"
import type { ReportingPeriod } from "@/features/dashboard/schemas"

export type PaceStatus = "on_track" | "at_risk" | "behind"

export const PACE_STATUS_META: Record<PaceStatus, { label: string; tone: StatusTone }> = {
  on_track: { label: "В графике", tone: "success" },
  at_risk: { label: "Есть риск", tone: "warning" },
  behind: { label: "Отстаёт", tone: "danger" },
}

/** Отставание от темпа, которое ещё считаем нормой (5 %) */
const ON_TRACK_TOLERANCE = 0.95
/** Ниже 80 % ожидаемого темпа — менеджер отстаёт */
const AT_RISK_THRESHOLD = 0.8

/** Какую долю плана «должны» были выполнить к сегодняшнему дню при равномерном темпе. */
export function expectedProgress(period: ReportingPeriod): number {
  return period.daysElapsed / period.daysTotal
}

export function paceStatus(
  actual: number,
  plan: number,
  period: ReportingPeriod
): PaceStatus {
  const expected = expectedProgress(period)
  if (plan === 0 || expected === 0) return "on_track"

  const paceRatio = actual / plan / expected
  if (paceRatio >= ON_TRACK_TOLERANCE) return "on_track"
  if (paceRatio >= AT_RISK_THRESHOLD) return "at_risk"
  return "behind"
}

/** Линейный прогноз на конец периода при текущем темпе. */
export function forecastAtPeriodEnd(actual: number, period: ReportingPeriod): number {
  if (period.daysElapsed === 0) return 0
  return (actual / period.daysElapsed) * period.daysTotal
}

/** Сколько нужно продавать в день до конца периода, чтобы выполнить план. */
export function requiredDailyRevenue(
  actual: number,
  plan: number,
  period: ReportingPeriod
): number {
  const daysLeft = period.daysTotal - period.daysElapsed
  if (daysLeft <= 0) return 0
  return Math.max(plan - actual, 0) / daysLeft
}
