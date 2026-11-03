import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"
import { PAGE_LIMIT_MAX, paginatedSchema } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { companyDateOf } from "@/lib/datetime"

/**
 * «Мой день» через backend: рабочая смена, прогресс личных планов и счётчики дел на сегодня.
 * Показатели месяца из макета (оборот, заработок, направления) backend пока не отдаёт.
 */

export const workSessionSchema = z.object({
  id: z.string(),
  status: z.string(),
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }).nullable(),
  durationSeconds: z.int().nullable(),
})

export type WorkSession = z.infer<typeof workSessionSchema>

const planProgressSchema = z.object({
  id: z.string(),
  metric: z.string(),
  target: decimalStringSchema,
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  unit: z.enum(["count", "money"]),
  currency: currencyCodeSchema.nullable(),
  actual: decimalStringSchema.nullable(),
  percent: decimalStringSchema.nullable(),
  remaining: decimalStringSchema.nullable(),
  /** С `?daily=true`: накопительный факт по дням периода до сегодня */
  daily: z.array(z.object({ date: z.iso.date(), actual: decimalStringSchema })).default([]),
})

export type PlanProgress = z.infer<typeof planProgressSchema>

export type ServerDay = {
  today: string
  session: WorkSession | null
  plans: PlanProgress[]
  tasksToday: number
  tasksOverdue: number
  meetingsToday: number
}

const countSchema = z.object({ count: z.int().nonnegative() })

function count(auth: ApiAuth, path: string, query: Record<string, string>): Promise<number> {
  return apiRequest(path, { auth, query: { ...query, limit: 1 }, schema: countSchema }).then((page) => page.count)
}

export async function fetchServerDay(userId: string): Promise<ServerDay> {
  const auth = await getRenderAuth()
  const today = companyDateOf(new Date().toISOString())
  const [current, plans, tasksToday, tasksOverdue, meetingsToday] = await Promise.all([
    apiRequest("/api/v1/work-sessions/current/", { auth, schema: z.object({ session: workSessionSchema.nullable() }) }),
    apiRequest("/api/v1/plans/progress/", {
      auth,
      query: { scope: "user", scopeId: userId, limit: PAGE_LIMIT_MAX, daily: "true" },
      schema: paginatedSchema(planProgressSchema),
    }),
    count(auth, "/api/v1/activities/", { kind: "task", assigneeId: userId, taskStatus: "open", dueFrom: today, dueTo: today }),
    count(auth, "/api/v1/activities/", { kind: "task", assigneeId: userId, taskStatus: "open", overdue: "true" }),
    count(auth, "/api/v1/meetings/", { ownerId: userId, dateFrom: today, dateTo: today }),
  ])
  return {
    today,
    session: current.session,
    plans: plans.results.filter((plan) => plan.periodStart <= today && today <= plan.periodEnd),
    tasksToday,
    tasksOverdue,
    meetingsToday,
  }
}

/** `POST /work-sessions/start|stop/` — 409, если смена уже идёт или не начата */
export function toggleWorkSession(auth: ApiAuth, action: "start" | "stop"): Promise<WorkSession> {
  return apiRequest(`/api/v1/work-sessions/${action}/`, { method: "POST", auth, schema: workSessionSchema })
}

const monthMetricsSchema = z.object({
  salesCount: z.int().nonnegative(),
  newClients: z.int().nonnegative(),
  turnover: decimalStringSchema,
  received: decimalStringSchema,
  debt: decimalStringSchema,
  currency: currencyCodeSchema,
})

export type MonthMetrics = z.infer<typeof monthMetricsSchema>

/** `GET /payments/metrics/` — текущий месяц компании; область (свои / отдел / компания) — по роли */
export async function fetchMonthMetrics(): Promise<MonthMetrics> {
  return apiRequest("/api/v1/payments/metrics/", { auth: await getRenderAuth(), schema: monthMetricsSchema })
}
