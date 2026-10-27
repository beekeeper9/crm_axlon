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
