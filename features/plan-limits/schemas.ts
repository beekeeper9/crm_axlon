import { z } from "zod"

/**
 * Лимиты тарифа и их использование (`GET /subscription/usage/`, `/platform/companies/{id}/limits/`).
 * limit = -1 — без ограничения; used = null — база компании ещё не готова (только в панели платформы).
 */

export const LIMIT_METRICS = ["users", "customers", "deals"] as const

export type LimitMetric = (typeof LIMIT_METRICS)[number]

export const UNLIMITED = -1

export const metricUsageSchema = z.object({
  metric: z.enum(LIMIT_METRICS),
  used: z.int().nonnegative().nullable(),
  limit: z.int().min(UNLIMITED),
  state: z.enum(["ok", "warning", "reached"]),
  overridden: z.boolean(),
})

export type MetricUsage = z.infer<typeof metricUsageSchema>

export const planUsageSchema = z.object({ planCode: z.string(), metrics: z.array(metricUsageSchema) })

export type PlanUsage = z.infer<typeof planUsageSchema>

export const METRIC_LABELS: Record<LimitMetric, string> = {
  users: "Сотрудники",
  customers: "Клиенты",
  deals: "Сделки",
}
