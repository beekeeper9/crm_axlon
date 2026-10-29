import { z } from "zod"

import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"

/**
 * «Кабинет РОПа» (ТЗ «Кабинет РОПа»). Предлагаемая форма данных, НЕ согласована с backend.
 * Все числа считает backend детерминированно (SQL), а не ИИ; frontend только показывает
 * и подписывает их определениями (см. METRIC_DEFINITIONS).
 */

const refSchema = z.object({ id: z.string(), name: z.string() })
const ratioSchema = z.number().min(0).max(1)

export const dayLevelSchema = z.enum(["green", "yellow", "red"])

/** Запланированное отсутствие не даёт алерта; «не вышел без предупреждения» — даёт */
export const absenceSchema = z.object({
  kind: z.enum(["vacation", "sick", "day_off", "trip", "unplanned"]),
  label: z.string(),
  until: z.iso.date().nullable(),
})

export const planSchema = z.object({
  /** План продаж (клиенты с первым платежом); null — план не задан */
  target: z.int().nonnegative().nullable(),
  fact: z.int().nonnegative(),
  remaining: z.int().nonnegative().nullable(),
  /** Рабочие дни по календарю сотрудника */
  workDaysTotal: z.int().nonnegative(),
  workDaysLeft: z.int().nonnegative(),
  /** Сколько продаж положено к сегодня по рабочим дням */
  expectedToDate: z.number().nonnegative().nullable(),
  perDayNeeded: z.number().nonnegative().nullable(),
  /** Линейный прогноз на конец месяца — показывается с пометкой «прогноз» */
  forecast: z.number().nonnegative().nullable(),
  /** Цепочка к плану: сколько встреч должно состояться и сколько назначить */
  meetingsHeldNeeded: z.int().nonnegative().nullable(),
  meetingsToBookNeeded: z.int().nonnegative().nullable(),
  meetingToSale: ratioSchema.nullable(),
  attendance: ratioSchema.nullable(),
})

export const todayMetricsSchema = z.object({
  meetings: z.object({
    total: z.int().nonnegative(),
    confirmed: z.int().nonnegative(),
    toConfirm: z.int().nonnegative(),
    nextToConfirmAt: z.iso.datetime({ offset: true }).nullable(),
    held: z.int().nonnegative(),
    noShow: z.int().nonnegative(),
    rescheduled: z.int().nonnegative(),
    cancelled: z.int().nonnegative(),
    withoutOutcome: z.int().nonnegative(),
  }),
  payments: z.object({ count: z.int().nonnegative(), amount: decimalStringSchema, currency: currencyCodeSchema }),
  calls: z.object({ total: z.int().nonnegative(), answered: z.int().nonnegative(), conversations: z.int().nonnegative(), minutes: z.int().nonnegative() }),
  waitingReplies: z.object({ count: z.int().nonnegative(), maxWaitHours: z.number().nonnegative().nullable() }),
  tasks: z.object({ today: z.int().nonnegative(), overdue: z.int().nonnegative(), unassigned: z.int().nonnegative() }),
  /** Хвосты CRM — что не дозаполнено */
  hygiene: z.object({
    withoutOutcome: z.int().nonnegative(),
    rescheduledNoDate: z.int().nonnegative(),
    noNextStep: z.int().nonnegative(),
  }),
})

export const teamRowSchema = z.object({
  manager: refSchema,
  level: dayLevelSchema,
  /** Почему такой статус — правила backend простыми словами */
  reasons: z.array(z.string()),
  absence: absenceSchema.nullable(),
  /** Дней подряд без активности в рабочие дни; 0 — активность есть */
  inactiveDays: z.int().nonnegative(),
  /** Оценка дня 5/4/3/2 (предложение ТЗ, пороги обсуждаются); null — не считается */
  dayScore: z.int().min(2).max(5).nullable(),
  today: todayMetricsSchema,
  plan: planSchema,
})

export const attentionItemSchema = z.object({
  id: z.string(),
  priority: z.enum(["high", "medium"]),
  manager: refSchema.nullable(),
  problem: z.string(),
  value: z.string().nullable(),
  /** Куда вести: раздел и фильтр по сотруднику */
  target: z.enum(["meetings", "meetings_outcome", "after_meeting", "tasks", "leads_no_step", "calls", "manager"]),
})

export const teamTodaySchema = z.object({
  asOf: z.iso.datetime({ offset: true }),
  workDay: z.object({ number: z.int().positive(), total: z.int().positive(), monthLabel: z.string() }),
  attention: z.array(attentionItemSchema),
  rows: z.array(teamRowSchema),
  /** Строка «Отдел» — агрегат backend, а не сумма на frontend */
  department: z.object({ today: todayMetricsSchema, plan: planSchema }),
})

export const qualityPeriodSchema = z.enum(["week", "month"])

export const teamQualitySchema = z.object({
  period: qualityPeriodSchema,
  periodLabel: z.string(),
  meetings: z.object({
    booked: z.int().nonnegative(),
    confirmed: z.int().nonnegative(),
    held: z.int().nonnegative(),
    noShow: z.int().nonnegative(),
    cancelled: z.int().nonnegative(),
    rescheduled: z.int().nonnegative(),
    withoutOutcome: z.int().nonnegative(),
    heldWithPayment: z.int().nonnegative(),
  }),
  /** Состоялись, но не закрылись оплатой — с текущим этапом и следующим шагом */
  heldWithoutSale: z.array(
    z.object({ lead: refSchema, manager: refSchema, meetingAt: z.iso.datetime({ offset: true }), stageName: z.string(), nextStep: z.string().nullable() })
  ),
  calls: z.array(
    z.object({
      manager: refSchema,
      total: z.int().nonnegative(),
      conversations: z.int().nonnegative(),
      rated: z.int().nonnegative(),
      avgScore: z.number().min(1).max(5).nullable(),
      goalAchievedShare: ratioSchema.nullable(),
      nextStepShare: ratioSchema.nullable(),
    })
  ),
  toListen: z.array(
    z.object({ callId: z.string(), lead: refSchema.nullable(), manager: refSchema, score: z.int().min(1).max(5), kind: z.enum(["weak", "strong"]), summary: z.string() })
  ),
})

export const funnelStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  count: z.int().nonnegative(),
  amount: decimalStringSchema.nullable(),
  currency: currencyCodeSchema.nullable(),
  /** Медиана дней на этапе */
  medianAgeDays: z.number().nonnegative().nullable(),
  /** Сколько карточек дольше порога */
  staleCount: z.int().nonnegative(),
  /** Конверсия в следующий этап за период; null — истории переходов нет */
  conversionToNext: ratioSchema.nullable(),
  /** Скопление: backend сравнивает с прошлой неделей и нормой этапа */
  isPile: z.boolean(),
})

export const teamFunnelSchema = z.object({
  staleThresholdDays: z.int().positive(),
  pipelines: z.array(z.object({ id: z.string(), name: z.string(), stages: z.array(funnelStageSchema) })),
})

export const memberCardSchema = z.object({
  manager: refSchema,
  periodLabel: z.string(),
  absence: absenceSchema.nullable(),
  dayScores: z.array(z.object({ date: z.iso.date(), score: z.int().min(2).max(5).nullable(), isWorkDay: z.boolean() })),
  plan: planSchema,
  paymentsAmount: decimalStringSchema,
  currency: currencyCodeSchema,
  activity: z.array(z.object({ date: z.iso.date(), calls: z.int().nonnegative(), conversations: z.int().nonnegative(), isWorkDay: z.boolean() })),
  discipline: z.object({
    withoutOutcome: z.int().nonnegative(),
    noNextStep: z.int().nonnegative(),
    overdueTasks: z.int().nonnegative(),
    rescheduledNoDate: z.int().nonnegative(),
  }),
  callQuality: z
    .object({
      rated: z.int().nonnegative(),
      total: z.int().nonnegative(),
      distribution: z.array(z.object({ score: z.int().min(1).max(5), count: z.int().nonnegative() })),
      goalAchievedShare: ratioSchema.nullable(),
      nextStepShare: ratioSchema.nullable(),
      gaps: z.array(z.object({ label: z.string(), count: z.int().nonnegative() })),
    })
    .nullable(),
  /** «На что сделать упор» — правила backend (не ИИ), 3–5 пунктов */
  focusPoints: z.array(z.string()),
  dealsToPush: z.array(
    z.object({ id: z.string(), title: z.string(), stageName: z.string(), amount: decimalStringSchema.nullable(), currency: currencyCodeSchema.nullable(), nextStep: z.string().nullable() })
  ),
  toListen: teamQualitySchema.shape.toListen,
})

export type DayLevel = z.infer<typeof dayLevelSchema>
export type Absence = z.infer<typeof absenceSchema>
export type Plan = z.infer<typeof planSchema>
export type TodayMetrics = z.infer<typeof todayMetricsSchema>
export type TeamRow = z.infer<typeof teamRowSchema>
export type AttentionItem = z.infer<typeof attentionItemSchema>
export type TeamToday = z.infer<typeof teamTodaySchema>
export type QualityPeriod = z.infer<typeof qualityPeriodSchema>
export type TeamQuality = z.infer<typeof teamQualitySchema>
export type TeamFunnel = z.infer<typeof teamFunnelSchema>
export type FunnelStage = z.infer<typeof funnelStageSchema>
export type MemberCard = z.infer<typeof memberCardSchema>
