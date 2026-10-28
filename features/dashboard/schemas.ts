import { z } from "zod"

/**
 * Предлагаемая frontend-ом форма данных главной страницы.
 * НЕ согласована с backend — см. docs/API_CONTRACT.md, раздел «Главная».
 * Деньги — в валюте компании, доли — числа от 0 до 1.
 */

const metricWithPreviousSchema = z.object({
  value: z.number(),
  /** Значение за тот же отрезок прошлого периода — для сравнения */
  previous: z.number(),
})

export const reportingPeriodSchema = z.object({
  label: z.string(),
  start: z.iso.date(),
  end: z.iso.date(),
  daysTotal: z.int().positive(),
  daysElapsed: z.int().nonnegative(),
})

export const salesSummarySchema = z.object({
  period: reportingPeriodSchema,
  revenue: metricWithPreviousSchema.extend({ plan: z.number().nonnegative() }),
  wonDeals: metricWithPreviousSchema,
  conversionRate: metricWithPreviousSchema,
  averageDealSize: metricWithPreviousSchema,
})

export const revenueTrendSchema = z.object({
  period: reportingPeriodSchema,
  plan: z.number().nonnegative(),
  /** Накопительная выручка по дням; null — день ещё не наступил */
  points: z.array(
    z.object({
      date: z.iso.date(),
      actual: z.number().nullable(),
      plan: z.number(),
    })
  ),
})

export const teamMemberPerformanceSchema = z.object({
  managerId: z.string(),
  managerName: z.string(),
  plan: z.number().nonnegative(),
  actual: z.number().nonnegative(),
  wonDeals: z.int().nonnegative(),
  conversionRate: z.number().min(0).max(1),
  overdueTasks: z.int().nonnegative(),
})

export const teamPerformanceSchema = z.object({
  period: reportingPeriodSchema,
  members: z.array(teamMemberPerformanceSchema),
})

export const funnelStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  dealsCount: z.int().nonnegative(),
  amount: z.number().nonnegative(),
  /** Доля сделок, перешедших на следующий этап; null для последнего этапа */
  conversionToNext: z.number().min(0).max(1).nullable(),
  averageDaysInStage: z.number().nonnegative(),
})

export const salesFunnelSchema = z.object({
  pipelineName: z.string(),
  stages: z.array(funnelStageSchema),
})

export const attentionItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["stalled_deal", "overdue_tasks", "behind_plan", "no_next_step"]),
  severity: z.enum(["high", "medium"]),
  title: z.string(),
  description: z.string(),
})

export const attentionListSchema = z.object({
  items: z.array(attentionItemSchema),
})

export type ReportingPeriod = z.infer<typeof reportingPeriodSchema>
export type SalesSummary = z.infer<typeof salesSummarySchema>
export type RevenueTrend = z.infer<typeof revenueTrendSchema>
export type TeamMemberPerformance = z.infer<typeof teamMemberPerformanceSchema>
export type TeamPerformance = z.infer<typeof teamPerformanceSchema>
export type FunnelStage = z.infer<typeof funnelStageSchema>
export type SalesFunnel = z.infer<typeof salesFunnelSchema>
export type AttentionItem = z.infer<typeof attentionItemSchema>
export type AttentionList = z.infer<typeof attentionListSchema>

/* ───────────── «Мой день» менеджера ───────────── */

/** Плитки «Сейчас»: что требует внимания менеджера прямо сейчас */
export const nowSummarySchema = z.object({
  awaitingReply: z.int().nonnegative(),
  meetingsToday: z.object({ held: z.int().nonnegative(), total: z.int().nonnegative() }),
  meetingsWithoutOutcome: z.int().nonnegative(),
  reschedulesWithoutDate: z.int().nonnegative(),
  tasks: z.object({ overdue: z.int().nonnegative(), dueToday: z.int().nonnegative() }),
})

/**
 * Личный оборот за период. План к сегодняшнему дню и прогноз считает backend
 * (правила рабочих дней и ориентиров — бизнес-логика компании).
 */
export const personalTurnoverSchema = z.object({
  period: reportingPeriodSchema,
  turnover: z.number().nonnegative(),
  /** Ориентир на месяц; null — РОП не задал */
  plan: z.number().nonnegative().nullable(),
  planToDate: z.number().nonnegative().nullable(),
  forecast: z.number().nonnegative().nullable(),
  /** Прирост к тому же дню прошлого месяца */
  growth: z.object({ value: z.number(), comparedTo: z.iso.date() }),
  prepayments: z.number().nonnegative(),
  additionalPayments: z.number().nonnegative(),
  points: z.array(
    z.object({
      date: z.iso.date(),
      /** Накопительный оборот; null — день ещё не наступил */
      cumulative: z.number().nullable(),
      /** Положено по плану к этому дню */
      plan: z.number().nullable(),
      dailyTurnover: z.number().nullable(),
      dailySales: z.int().nullable(),
    })
  ),
})

/** Заработок считает backend по правилам мотивации компании; frontend только показывает */
export const earningsSchema = z.object({
  total: z.number().nonnegative(),
  notice: z.object({ title: z.string(), text: z.string() }).nullable(),
  lines: z.array(z.object({ label: z.string(), amount: z.number(), note: z.string().nullable() })),
  footnote: z.string().nullable(),
})

export const personalKpisSchema = z.object({
  sales: metricWithPreviousSchema.extend({ plan: z.int().nonnegative().nullable() }),
  salesPerMeeting: z.object({
    ratio: z.number().min(0).max(1),
    sales: z.int().nonnegative(),
    meetingsHeld: z.int().nonnegative(),
    /** Порог премии, если он есть в мотивации компании */
    bonusThreshold: z.number().min(0).max(1).nullable(),
  }),
  averageDeal: z.object({ value: z.number().nonnegative(), note: z.string().nullable() }),
  meetings: z.object({
    held: z.int().nonnegative(),
    attendanceRate: z.number().min(0).max(1),
    upcoming: z.int().nonnegative(),
  }),
  /** Показатели месяца: встречи по дате встречи, продажи по оплате */
  monthFunnel: z.object({
    assigned: z.int().nonnegative(),
    passed: z.int().nonnegative(),
    held: z.int().nonnegative(),
    sales: z.int().nonnegative(),
  }),
})

/** Разбивка по направлениям продаж (их набор задаёт компания) */
export const salesSegmentsSchema = z.object({
  segments: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      sales: metricWithPreviousSchema,
      turnover: z.number().nonnegative(),
      prepayments: z.number().nonnegative(),
      additionalPayments: z.number().nonnegative(),
      averageDeal: z.number().nonnegative(),
      share: z.number().min(0).max(1),
    })
  ),
})

export type NowSummary = z.infer<typeof nowSummarySchema>
export type PersonalTurnover = z.infer<typeof personalTurnoverSchema>
export type Earnings = z.infer<typeof earningsSchema>
export type PersonalKpis = z.infer<typeof personalKpisSchema>
export type SalesSegments = z.infer<typeof salesSegmentsSchema>
