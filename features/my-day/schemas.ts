import { z } from "zod"

import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"

/**
 * Предлагаемая форма данных «Моего дня» менеджера. НЕ согласована с backend.
 * Только собственные показатели пользователя: backend берёт сотрудника из токена.
 * Все расчёты (рабочие дни, план к сегодня, нужно в день, прогноз, темп) — на backend.
 */

const money = decimalStringSchema
const ratio = z.number().min(0)

/** Плитки «Сейчас»: только текущий месяц; нулевые плитки интерфейс не показывает */
export const nowSummarySchema = z.object({
  awaitingReply: z.object({
    count: z.int().nonnegative(),
    /** Дольше всех ждёт, в рабочих минутах (рабочее время компании) */
    longestWaitWorkMinutes: z.int().nonnegative().nullable(),
  }),
  meetingsToday: z.object({ held: z.int().nonnegative(), total: z.int().nonnegative() }),
  meetingsWithoutOutcome: z.int().nonnegative(),
  reschedulesWithoutDate: z.int().nonnegative(),
  tasks: z.object({ overdue: z.int().nonnegative(), dueToday: z.int().nonnegative() }),
})

export const myMonthSchema = z.object({
  period: z.object({
    /** YYYY-MM */
    month: z.string().regex(/^\d{4}-\d{2}$/),
    label: z.string(),
    isCurrent: z.boolean(),
    /** Рабочие дни по календарю сотрудника */
    workDaysTotal: z.int().nonnegative(),
    workDaysLeft: z.int().nonnegative(),
  }),
  now: nowSummarySchema.nullable(),
  currency: currencyCodeSchema,
  turnover: z.object({
    fact: money,
    /** Ориентир на месяц; null — не задан */
    target: money.nullable(),
    /** Сколько положено к сегодня по рабочим дням */
    expectedToDate: money.nullable(),
    /** Линейный прогноз на конец месяца при текущем темпе */
    forecast: money.nullable(),
    progress: ratio.nullable(),
    expectedProgress: ratio.nullable(),
    /** Прирост к той же дате прошлого месяца */
    growth: z.object({ amount: money, comparedTo: z.iso.date() }).nullable(),
    prepayments: money,
    additionalPayments: money,
    /** Пояснение правила (например, «первый месяц: 5 % со всего оборота») */
    note: z.string().nullable(),
  }),
  earnings: z
    .object({
      total: money,
      notice: z.object({ title: z.string(), lines: z.array(z.string()) }).nullable(),
      lines: z.array(z.object({ label: z.string(), amount: money, note: z.string().nullable() })),
      footnote: z.string().nullable(),
    })
    .nullable(),
  kpis: z.object({
    sales: z.object({ count: z.int().nonnegative(), growth: z.int().nullable(), comparedTo: z.iso.date().nullable(), planNote: z.string() }),
    salesPerMeeting: z.object({ ratio: ratio.nullable(), sales: z.int().nonnegative(), held: z.int().nonnegative(), bonusThreshold: ratio.nullable() }),
    averageDeal: z.object({ amount: money.nullable(), note: z.string().nullable() }),
    meetingsHeld: z.object({ count: z.int().nonnegative(), attendance: ratio.nullable(), upcoming: z.int().nonnegative() }),
  }),
  /** Встречи — по дате встречи, продажи — по оплате */
  monthFunnel: z.object({
    assigned: z.int().nonnegative(),
    passed: z.int().nonnegative(),
    held: z.int().nonnegative(),
    sales: z.int().nonnegative(),
    upcoming: z.int().nonnegative(),
  }),
  daily: z.array(
    z.object({
      date: z.iso.date(),
      /** null — день ещё не наступил */
      cumulative: money.nullable(),
      /** Сколько положено к этому дню с учётом рабочих дней */
      plan: money,
      turnover: money.nullable(),
      sales: z.int().nonnegative().nullable(),
    })
  ),
  /** Направления компании (настраиваются) */
  segments: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      sales: z.int().nonnegative(),
      previousSales: z.int().nonnegative().nullable(),
      turnover: money,
      prepayments: money,
      additionalPayments: money,
      averageDeal: money.nullable(),
      share: ratio,
    })
  ),
})

export const todayActionKindSchema = z.enum([
  "reply",
  "overdue_task",
  "meeting_outcome",
  "confirm_meeting",
  "no_next_step",
  "stale_deal",
])

/** Срочность задаёт backend: «сейчас» — теряем клиента, «сегодня» — до конца дня, «не забыть» — на неделе */
export const urgencySchema = z.enum(["now", "today", "soon"])

export const todayActionSchema = z.object({
  id: z.string(),
  kind: todayActionKindSchema,
  urgency: urgencySchema,
  lead: z.object({ id: z.string(), name: z.string() }),
  /** Что не так, простыми словами */
  problem: z.string(),
  /** Уточнение: сколько ждёт клиент, сколько дней без движения */
  detail: z.string().nullable(),
  /** Время события: начало встречи или срок задачи */
  at: z.iso.datetime({ offset: true }).nullable(),
  amount: decimalStringSchema.nullable(),
  currency: currencyCodeSchema.nullable(),
})

export const todayActionsSchema = z.object({
  asOf: z.iso.datetime({ offset: true }),
  actions: z.array(todayActionSchema),
})

export type NowSummary = z.infer<typeof nowSummarySchema>
export type MyMonth = z.infer<typeof myMonthSchema>
export type TodayActionKind = z.infer<typeof todayActionKindSchema>
export type Urgency = z.infer<typeof urgencySchema>
export type TodayAction = z.infer<typeof todayActionSchema>
export type TodayActions = z.infer<typeof todayActionsSchema>
