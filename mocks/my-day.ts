/**
 * ДЕМО-ДАННЫЕ «Мой день» для вымышленного менеджера (Айбек Садыков, m-1).
 * Список дел собран из тех же демо-задач, встреч, сделок и «Фокуса», что и остальные разделы, —
 * клик по пункту ведёт к той же записи. Правила отбора и срочности в реальном режиме — на backend.
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import type { MyMonth, NowSummary, TodayAction, TodayActions, Urgency } from "@/features/my-day/schemas"
import { demoDeals } from "@/mocks/crm"
import { demoFocusList } from "@/mocks/focus"
import { demoMeetings } from "@/mocks/meetings"
import { demoTasks } from "@/mocks/tasks"
import { DEMO_NOW, DEMO_TODAY, demoDate } from "@/mocks/team"

export const DEMO_MONTH = "2026-10"
const DEMO_MANAGER_ID = "m-1"

/** Оплаты приходят неравномерно: в отдельные дни, по одной сделке (сумма = оборот месяца) */
const PAYMENT_DAYS: Record<number, number> = { 2: 180_000, 6: 240_000, 9: 310_000, 13: 220_000, 15: 150_000, 20: 420_000, 22: 260_000, 24: 280_000, 27: 250_000 }
const TARGET = 2_400_000
const DAYS_IN_MONTH = 31
const TODAY_DAY = Number(DEMO_TODAY.slice(8))

function isWorkDay(day: number): boolean {
  return new Date(Date.UTC(2026, 9, day)).getUTCDay() !== 0
}

const WORK_DAYS = Array.from({ length: DAYS_IN_MONTH }, (_, index) => index + 1).filter(isWorkDay)

function buildDaily(): MyMonth["daily"] {
  let cumulative = 0
  let workDaysPassed = 0
  return Array.from({ length: DAYS_IN_MONTH }, (_, index) => {
    const day = index + 1
    if (isWorkDay(day)) workDaysPassed += 1
    const date = `2026-10-${String(day).padStart(2, "0")}`
    // План к дню — по рабочим дням: в воскресенье линия не растёт
    const plan = Math.round((TARGET * workDaysPassed) / WORK_DAYS.length).toFixed(2)
    if (day > TODAY_DAY) return { date, cumulative: null, plan, turnover: null, sales: null }
    const amount = PAYMENT_DAYS[day] ?? 0
    cumulative += amount
    return { date, cumulative: cumulative.toFixed(2), plan, turnover: amount.toFixed(2), sales: amount > 0 ? 1 : 0 }
  })
}

/** «Сейчас» из тех же демо-задач, встреч и «Фокуса», что и список дел, — цифры совпадают */
function demoNow(userId: string): NowSummary {
  const awaiting = (demoFocusList.groups.find((group) => group.id === "awaiting")?.items ?? []).filter((item) => item.manager.id === userId)
  const waits = awaiting.flatMap((item) => (item.lastInteraction ? [Math.round(hoursSince(item.lastInteraction.at) * 60)] : []))
  const today = demoMeetings.filter((meeting) => meeting.host.id === userId && meeting.startsAt.startsWith(DEMO_TODAY))
  const myDeals = demoDeals.filter((deal) => deal.manager.id === userId)
  const myTasks = demoTasks.filter((task) => task.assignee?.id === userId && task.status === "open")
  return {
    awaitingReply: { count: awaiting.length, longestWaitWorkMinutes: waits.length ? Math.max(...waits) : null },
    meetingsToday: { held: today.filter((meeting) => meeting.status === "held").length, total: today.length },
    meetingsWithoutOutcome: demoMeetings.filter((meeting) => meeting.host.id === userId && meeting.outcomeRequired).length,
    reschedulesWithoutDate: myDeals.filter((deal) => deal.stageId === "s-resched" && deal.nextAction === null).length,
    tasks: { overdue: myTasks.filter((task) => task.isOverdue).length, dueToday: myTasks.filter((task) => task.dueGroup === "today").length },
  }
}

/** null — за этот месяц в демо-данных ничего нет */
export function demoMyMonth(month: string, userId: string): MyMonth | null {
  // Подробные демо-показатели есть только у демо-менеджера; у новых сотрудников истории ещё нет
  if (month !== DEMO_MONTH || userId !== DEMO_MANAGER_ID) return null
  const workDaysLeft = WORK_DAYS.filter((day) => day > TODAY_DAY).length
  return {
    period: { month, label: "Октябрь 2026", isCurrent: true, workDaysTotal: WORK_DAYS.length, workDaysLeft },
    now: demoNow(userId),
    currency: "KGS",
    turnover: {
      fact: "2310000.00",
      target: TARGET.toFixed(2),
      expectedToDate: buildDaily()[TODAY_DAY - 1].plan,
      forecast: "2652200.00",
      progress: 2_310_000 / TARGET,
      expectedProgress: Number(buildDaily()[TODAY_DAY - 1].plan) / TARGET,
      growth: { amount: "340000.00", comparedTo: "2026-09-27" },
      prepayments: "1890000.00",
      additionalPayments: "420000.00",
      note: "Бонус 5 % со всего оборота месяца",
    },
    earnings: {
      total: "145500.00",
      notice: null,
      lines: [
        { label: "Оклад", amount: "30000.00", note: null },
        { label: "5 % со всего оборота", amount: "115500.00", note: "оборот 2 310 000 · ориентир 2 400 000" },
      ],
      footnote: "Расчёт по правилам мотивации компании. Итог фиксируется после закрытия месяца.",
    },
    kpis: {
      sales: { count: 9, growth: 2, comparedTo: "2026-09-27", planNote: "план продаж 12 · осталось 3" },
      salesPerMeeting: { ratio: 9 / 29, sales: 9, held: 29, bonusThreshold: 0.25 },
      averageDeal: { amount: "256700.00", note: "оборот ÷ продажи" },
      meetingsHeld: { count: 29, attendance: 0.62, upcoming: 6 },
    },
    monthFunnel: { assigned: 52, passed: 47, held: 29, sales: 9, upcoming: 5 },
    daily: buildDaily(),
    segments: [
      { id: "new", name: "Новые клиенты", sales: 6, previousSales: 5, turnover: "1480000.00", prepayments: "1200000.00", additionalPayments: "280000.00", averageDeal: "246700.00", share: 0.64 },
      { id: "repeat", name: "Повторные продажи", sales: 3, previousSales: 2, turnover: "830000.00", prepayments: "690000.00", additionalPayments: "140000.00", averageDeal: "276700.00", share: 0.36 },
    ],
  }
}

const URGENCY_ORDER: Record<Urgency, number> = { now: 0, today: 1, soon: 2 }

/** Дней без движения, после которых демо-слой напоминает о сделке (правило backend — вопрос) */
const STALE_DAYS = 7

function hoursSince(iso: string): number {
  return (new Date(DEMO_NOW).getTime() - new Date(iso).getTime()) / 3_600_000
}

function waitLabel(hours: number): string {
  const whole = Math.floor(hours)
  const minutes = Math.round((hours - whole) * 60)
  return whole > 0 ? `ждёт ${whole} ч ${minutes} мин` : `ждёт ${minutes} мин`
}

export function demoTodayActionsFor(userId: string): TodayActions {
  const deals = new Map(demoDeals.map((deal) => [deal.id, deal]))
  const money = (leadId: string) => ({ amount: deals.get(leadId)?.amount ?? null, currency: deals.get(leadId)?.currency ?? null })
  const actions: TodayAction[] = []

  for (const item of demoFocusList.groups.find((group) => group.id === "awaiting")?.items ?? []) {
    if (item.manager.id !== userId || !item.lastInteraction) continue
    actions.push({
      id: `reply-${item.id}`,
      kind: "reply",
      urgency: "now",
      lead: item.lead,
      problem: `Клиент ждёт ответа: «${item.lastInteraction.summary}»`,
      detail: waitLabel(hoursSince(item.lastInteraction.at)),
      at: null,
      ...money(item.lead.id),
    })
  }

  for (const meeting of demoMeetings) {
    if (meeting.host.id !== userId) continue
    if (meeting.outcomeRequired) {
      actions.push({
        id: `outcome-${meeting.id}`,
        kind: "meeting_outcome",
        urgency: "now",
        lead: meeting.lead,
        problem: "Встреча прошла, итог не записан",
        detail: null,
        at: meeting.startsAt,
        ...money(meeting.lead.id),
      })
    }
    const day = meeting.startsAt.slice(0, 10)
    const isUpcoming = (meeting.status === "scheduled" || meeting.status === "confirmed") && day >= DEMO_TODAY && day <= demoDate(1)
    if (isUpcoming && meeting.clientConfirmation !== "confirmed") {
      actions.push({
        id: `confirm-${meeting.id}`,
        kind: "confirm_meeting",
        urgency: "today",
        lead: meeting.lead,
        problem:
          meeting.clientConfirmation === "not_sent"
            ? "Встреча не подтверждена: напоминание не отправлялось"
            : "Клиент ещё не подтвердил встречу",
        detail: null,
        at: meeting.startsAt,
        ...money(meeting.lead.id),
      })
    }
  }

  for (const task of demoTasks) {
    if (task.assignee?.id !== userId || !task.isOverdue || !task.lead) continue
    actions.push({
      id: `task-${task.id}`,
      kind: "overdue_task",
      urgency: "now",
      lead: task.lead,
      problem: `Просрочена задача «${task.title}»`,
      detail: null,
      at: task.dueAt,
      ...money(task.lead.id),
    })
  }

  for (const deal of demoDeals) {
    if (deal.manager.id !== userId || deal.stageId.endsWith("won") || deal.stageId.endsWith("lost") || deal.stageId === "c-done") continue
    const daysOnStage = Math.floor(hoursSince(deal.stageEnteredAt) / 24)
    if (!deal.nextAction) {
      actions.push({
        id: `step-${deal.id}`,
        kind: "no_next_step",
        urgency: "today",
        lead: { id: deal.id, name: deal.title },
        problem: "Нет следующего шага — сделка может потеряться",
        detail: null,
        at: null,
        amount: deal.amount,
        currency: deal.currency,
      })
    } else if (daysOnStage >= STALE_DAYS) {
      actions.push({
        id: `stale-${deal.id}`,
        kind: "stale_deal",
        urgency: "soon",
        lead: { id: deal.id, name: deal.title },
        problem: "Давно без движения по этапу",
        detail: `${daysOnStage} дн. на этапе`,
        at: null,
        amount: deal.amount,
        currency: deal.currency,
      })
    }
  }

  // Один пункт на клиента — самый срочный
  const byLead = new Map<string, TodayAction>()
  for (const action of actions.toSorted((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency])) {
    if (!byLead.has(action.lead.id)) byLead.set(action.lead.id, action)
  }
  return { asOf: DEMO_NOW, actions: [...byLead.values()] }
}
