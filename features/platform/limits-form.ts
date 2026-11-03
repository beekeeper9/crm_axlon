import { UNLIMITED, type LimitMetric, type MetricUsage } from "@/features/plan-limits/schemas"

/** Строка редактора лимитов: «из тарифа» или своё значение (число или «без лимита») */
export type LimitRow = { metric: LimitMetric; custom: boolean; unlimited: boolean; value: string }

export function limitRows(metrics: readonly MetricUsage[]): LimitRow[] {
  return metrics.map((metric) => ({
    metric: metric.metric,
    custom: metric.overridden,
    unlimited: metric.limit === UNLIMITED,
    value: metric.limit === UNLIMITED ? "" : String(metric.limit),
  }))
}

/**
 * Тело PUT: только изменённые метрики — остальные backend берёт из тарифа.
 * null — в строке не целое число от 0.
 */
export function limitsPayload(rows: readonly LimitRow[]): Partial<Record<LimitMetric, number>> | null {
  const limits: Partial<Record<LimitMetric, number>> = {}
  for (const row of rows) {
    if (!row.custom) continue
    if (row.unlimited) {
      limits[row.metric] = UNLIMITED
      continue
    }
    if (!/^\d+$/.test(row.value.trim())) return null
    limits[row.metric] = Number(row.value.trim())
  }
  return limits
}
