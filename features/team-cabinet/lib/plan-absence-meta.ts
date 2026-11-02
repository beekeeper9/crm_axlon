/** Справочники форм кабинета: значения — как в API backend, подписи — для интерфейса */

export const ABSENCE_KINDS = ["vacation", "sick", "day_off", "business_trip", "no_show"] as const
export type AbsenceKind = (typeof ABSENCE_KINDS)[number]

export const ABSENCE_LABELS: Record<AbsenceKind, string> = {
  vacation: "Отпуск",
  sick: "Больничный",
  day_off: "Отгул",
  business_trip: "Командировка",
  no_show: "Не вышел без предупреждения",
}

export const PLAN_METRICS = ["monthly_sales", "monthly_turnover", "weekly_leads", "weekly_prepayments", "daily_calls"] as const
export type PlanMetric = (typeof PLAN_METRICS)[number]

export const PLAN_METRIC_LABELS: Record<PlanMetric, string> = {
  monthly_sales: "Продажи за месяц",
  monthly_turnover: "Оборот за месяц",
  weekly_leads: "Лиды за неделю",
  weekly_prepayments: "Предоплаты за неделю",
  daily_calls: "Звонки за день",
}

/** Месячные показатели — формы и кабинет работают с ними; остальные backend тоже принимает */
export const MONTHLY_METRICS: readonly PlanMetric[] = ["monthly_sales", "monthly_turnover"]
