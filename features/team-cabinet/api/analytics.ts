import { z } from "zod"

import { listFunnels, type Funnel } from "@/features/sales/funnel/funnel-api"
import { apiRequest } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { decimalStringSchema } from "@/lib/api/money"
import { getRenderAuth } from "@/lib/auth/token-store"

/**
 * Аналитика кабинета через backend: `GET /team/funnel/`, `/team/losses/`,
 * `/team/members/{id}/scores/`. Конверсию, возраст на этапе, причины и оценки считает
 * backend по записям компании; frontend только показывает.
 */

const stageStatSchema = z.object({
  stageId: z.string(),
  name: z.string(),
  kind: z.enum(["open", "won", "lost"]),
  position: z.int(),
  openDeals: z.int().nonnegative(),
  openAmount: decimalStringSchema,
  medianAgeDays: decimalStringSchema.nullable(),
  staleDeals: z.int().nonnegative(),
  reached: z.int().nonnegative(),
  reachedPrevious: z.int().nonnegative(),
  movedOn: z.int().nonnegative(),
  conversion: decimalStringSchema.nullable(),
  isBottleneck: z.boolean(),
})

const funnelReportSchema = z.object({
  pipelineId: z.string(),
  pipelineName: z.string(),
  dateFrom: z.iso.date(),
  dateTo: z.iso.date(),
  previousFrom: z.iso.date(),
  previousTo: z.iso.date(),
  staleDays: z.int().positive(),
  stages: z.array(stageStatSchema),
  won: z.int().nonnegative(),
  lost: z.int().nonnegative(),
  wonPrevious: z.int().nonnegative(),
  lostPrevious: z.int().nonnegative(),
  currency: z.string(),
})

export type StageStat = z.infer<typeof stageStatSchema>
export type FunnelReport = z.infer<typeof funnelReportSchema>

const reasonSchema = z.object({
  reason: z.string(),
  total: z.int().nonnegative(),
  byMonth: z.record(z.string(), z.int().nonnegative()),
})

const lossReportSchema = z.object({
  dateFrom: z.iso.date(),
  dateTo: z.iso.date(),
  previousFrom: z.iso.date(),
  previousTo: z.iso.date(),
  months: z.array(z.string()),
  lostDeals: z.int().nonnegative(),
  lostPrevious: z.int().nonnegative(),
  lossReasons: z.array(reasonSchema),
  meetingsTotal: z.int().nonnegative(),
  meetingsCancelled: z.int().nonnegative(),
  meetingsNoShow: z.int().nonnegative(),
  cancelledPrevious: z.int().nonnegative(),
  noShowPrevious: z.int().nonnegative(),
  cancelReasons: z.array(reasonSchema),
  noShowReasons: z.array(reasonSchema),
  leadResponse: z.object({
    leads: z.int().nonnegative(),
    responded: z.int().nonnegative(),
    medianMinutes: decimalStringSchema.nullable(),
    within15Min: z.int().nonnegative(),
    within60Min: z.int().nonnegative(),
  }),
})

export type ReasonCount = z.infer<typeof reasonSchema>
export type LossReport = z.infer<typeof lossReportSchema>

const scoreHistorySchema = z.object({
  userId: z.string(),
  dateFrom: z.iso.date(),
  dateTo: z.iso.date(),
  points: z.array(
    z.object({
      day: z.iso.date(),
      points: z.int().min(0).max(100).nullable(),
      grade: z.int().min(2).max(5).nullable(),
      reason: z.enum(["silent", "absent"]).nullable(),
    })
  ),
})

export type ScoreHistory = z.infer<typeof scoreHistorySchema>

export type FunnelQuery = { pipelineId: string | null; dateFrom: string | null; dateTo: string | null; staleDays: number | null }

/** Отчёт по воронке и список воронок для выбора */
export async function fetchFunnelReport(query: FunnelQuery): Promise<{ report: FunnelReport; pipelines: Funnel[] } | null> {
  const auth = await getRenderAuth()
  try {
    const [report, pipelines] = await Promise.all([
      apiRequest("/api/v1/team/funnel/", {
        auth,
        query: {
          pipelineId: query.pipelineId ?? undefined,
          dateFrom: query.dateFrom ?? undefined,
          dateTo: query.dateTo ?? undefined,
          staleDays: query.staleDays ?? undefined,
        },
        schema: funnelReportSchema,
      }),
      listFunnels(auth),
    ])
    return { report, pipelines }
  } catch (error) {
    // В компании ещё нет воронки (или выбранная недоступна)
    if (error instanceof ApiError && error.kind === "not_found") return null
    throw error
  }
}

export async function fetchLossReport(dateFrom: string | null, dateTo: string | null): Promise<LossReport> {
  return apiRequest("/api/v1/team/losses/", {
    auth: await getRenderAuth(),
    query: { dateFrom: dateFrom ?? undefined, dateTo: dateTo ?? undefined },
    schema: lossReportSchema,
  })
}

/** Оценка дня за период карточки (backend отдаёт не больше 93 дней) */
export async function fetchScoreHistory(userId: string, dateFrom: string | null, dateTo: string | null): Promise<ScoreHistory> {
  return apiRequest(`/api/v1/team/members/${encodeURIComponent(userId)}/scores/`, {
    auth: await getRenderAuth(),
    query: { dateFrom: dateFrom ?? undefined, dateTo: dateTo ?? undefined },
    schema: scoreHistorySchema,
  })
}

/** Изменение к прошлому периоду: «+3» / «−2» / «без изменений»; null — сравнивать не с чем */
export function changeLabel(current: number, previous: number): string | null {
  if (current === previous) return previous === 0 ? null : "без изменений"
  const diff = current - previous
  return `${diff > 0 ? "+" : "−"}${Math.abs(diff)} к прошлому периоду`
}
