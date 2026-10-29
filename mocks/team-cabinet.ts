/**
 * ДЕМО-ДАННЫЕ «Кабинета РОПа».
 * Счётчики «на сегодня» собираются из тех же демо-встреч, задач, сделок и звонков, что и
 * в других разделах, поэтому клик по числу открывает список с тем же количеством.
 * Планы, оплаты и отсутствия заданы явно (в реальном режиме — данные backend).
 * Правила светофора, оценки дня и «на что сделать упор» — предложение ТЗ, их считает backend.
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import type {
  Absence,
  AttentionItem,
  DayLevel,
  MemberCard,
  Plan,
  QualityPeriod,
  TeamFunnel,
  TeamQuality,
  TeamRow,
  TeamToday,
  TodayMetrics,
} from "@/features/team-cabinet/schemas"
import { addDecimals } from "@/lib/decimal"
import { demoCalls } from "@/mocks/calls"
import { demoDeals, demoSalesConfig } from "@/mocks/crm"
import { demoFocusList } from "@/mocks/focus"
import { demoMeetings } from "@/mocks/meetings"
import { demoTasks } from "@/mocks/tasks"
import { DEMO_NOW, DEMO_TODAY, demoDate, demoManagers } from "@/mocks/team"

const WORK_DAYS_TOTAL = 22
const WORK_DAYS_LEFT = 4

type ManagerSetup = {
  target: number | null
  fact: number
  payments: [count: number, amount: string]
  meetingToSale: number
  attendance: number
  absence: Absence | null
  workDaysTotal: number
  workDaysLeft: number
  /** Дней без активности подряд (в реальном режиме — по журналу событий) */
  inactiveDays: number
}

const SETUP: Record<string, ManagerSetup> = {
  "m-1": { target: 12, fact: 9, payments: [1, "250000.00"], meetingToSale: 0.31, attendance: 0.62, absence: null, workDaysTotal: 22, workDaysLeft: 4, inactiveDays: 0 },
  "m-2": { target: 11, fact: 8, payments: [0, "0.00"], meetingToSale: 0.28, attendance: 0.58, absence: null, workDaysTotal: 22, workDaysLeft: 4, inactiveDays: 0 },
  "m-3": { target: 10, fact: 7, payments: [1, "180000.00"], meetingToSale: 0.24, attendance: 0.55, absence: null, workDaysTotal: 22, workDaysLeft: 4, inactiveDays: 0 },
  "m-4": { target: 10, fact: 5, payments: [0, "0.00"], meetingToSale: 0.2, attendance: 0.51, absence: null, workDaysTotal: 22, workDaysLeft: 4, inactiveDays: 0 },
  "m-5": {
    target: 9,
    fact: 4,
    payments: [0, "0.00"],
    meetingToSale: 0.17,
    attendance: 0.5,
    absence: { kind: "vacation", label: "Отпуск", until: "2026-10-31" },
    workDaysTotal: 17,
    workDaysLeft: 0,
    inactiveDays: 0,
  },
  "m-6": { target: null, fact: 3, payments: [0, "0.00"], meetingToSale: 0.14, attendance: 0.48, absence: null, workDaysTotal: 22, workDaysLeft: 4, inactiveDays: 2 },
}

const OPEN_STAGES = new Set(demoSalesConfig.pipelines.flatMap((pipeline) => pipeline.stages.filter((stage) => stage.kind === "open").map((stage) => stage.id)))
const stageName = (id: string) => demoSalesConfig.pipelines.flatMap((pipeline) => pipeline.stages).find((stage) => stage.id === id)?.name ?? ""

function buildPlan(setup: ManagerSetup): Plan {
  const worked = setup.workDaysTotal - setup.workDaysLeft
  const remaining = setup.target === null ? null : Math.max(setup.target - setup.fact, 0)
  const heldNeeded = remaining === null ? null : Math.ceil(remaining / setup.meetingToSale)
  return {
    target: setup.target,
    fact: setup.fact,
    remaining,
    workDaysTotal: setup.workDaysTotal,
    workDaysLeft: setup.workDaysLeft,
    expectedToDate: setup.target === null ? null : round1((setup.target * worked) / setup.workDaysTotal),
    perDayNeeded: remaining === null || setup.workDaysLeft === 0 ? null : round1(remaining / setup.workDaysLeft),
    forecast: worked === 0 ? null : round1((setup.fact / worked) * setup.workDaysTotal),
    meetingsHeldNeeded: heldNeeded,
    meetingsToBookNeeded: heldNeeded === null ? null : Math.ceil(heldNeeded / setup.attendance),
    meetingToSale: setup.meetingToSale,
    attendance: setup.attendance,
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function hoursSince(iso: string): number {
  return (new Date(DEMO_NOW).getTime() - new Date(iso).getTime()) / 3_600_000
}

function todayMetrics(managerId: string, setup: ManagerSetup): TodayMetrics {
  const meetings = demoMeetings.filter((meeting) => meeting.host.id === managerId)
  const today = meetings.filter((meeting) => meeting.startsAt.startsWith(DEMO_TODAY))
  const upcomingUnconfirmed = today
    .filter((meeting) => (meeting.status === "scheduled" || meeting.status === "confirmed") && meeting.clientConfirmation !== "confirmed")
    .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt))
  const calls = demoCalls.filter((call) => call.manager.id === managerId && call.at.startsWith(DEMO_TODAY))
  const waiting = (demoFocusList.groups.find((group) => group.id === "awaiting")?.items ?? []).filter((item) => item.manager.id === managerId)
  const tasks = demoTasks.filter((task) => task.status === "open")
  const deals = demoDeals.filter((deal) => deal.manager.id === managerId && OPEN_STAGES.has(deal.stageId))
  const myLeads = new Set(demoDeals.filter((deal) => deal.manager.id === managerId).map((deal) => deal.id))

  return {
    meetings: {
      total: today.length,
      confirmed: today.filter((meeting) => meeting.clientConfirmation === "confirmed").length,
      toConfirm: upcomingUnconfirmed.length,
      nextToConfirmAt: upcomingUnconfirmed[0]?.startsAt ?? null,
      held: today.filter((meeting) => meeting.status === "held").length,
      noShow: today.filter((meeting) => meeting.status === "no_show").length,
      rescheduled: today.filter((meeting) => meeting.status === "rescheduled").length,
      cancelled: today.filter((meeting) => meeting.status === "cancelled").length,
      withoutOutcome: today.filter((meeting) => meeting.outcomeRequired).length,
    },
    payments: { count: setup.payments[0], amount: setup.payments[1], currency: "KGS" },
    calls: {
      total: calls.length,
      answered: calls.filter((call) => call.status === "answered").length,
      conversations: calls.filter((call) => call.status === "answered" && call.durationSec >= 30).length,
      minutes: Math.round(calls.reduce((sum, call) => sum + call.durationSec, 0) / 60),
    },
    waitingReplies: {
      count: waiting.length,
      maxWaitHours: waiting.length === 0 ? null : round1(Math.max(...waiting.map((item) => (item.lastInteraction ? hoursSince(item.lastInteraction.at) : 0)))),
    },
    tasks: {
      today: tasks.filter((task) => task.assignee?.id === managerId && task.dueGroup === "today").length,
      overdue: tasks.filter((task) => task.assignee?.id === managerId && task.isOverdue).length,
      unassigned: tasks.filter((task) => task.assignee === null && task.lead !== null && myLeads.has(task.lead.id)).length,
    },
    hygiene: {
      withoutOutcome: meetings.filter((meeting) => meeting.outcomeRequired).length,
      rescheduledNoDate: deals.filter((deal) => deal.stageId === "s-resched" && deal.nextAction === null).length,
      noNextStep: deals.filter((deal) => deal.nextAction === null).length,
    },
  }
}

/** Светофор по правилам-предложению ТЗ (п. 4.2); пороги настраиваются на backend */
function dayLevel(metrics: TodayMetrics, setup: ManagerSetup): { level: DayLevel; reasons: string[] } {
  if (setup.absence) return { level: "green", reasons: [`${setup.absence.label} — отсутствие запланировано, алерта нет`] }
  const red: string[] = []
  if (setup.inactiveDays > 0) red.push(`Нет активности в рабочий день${setup.inactiveDays > 1 ? ` (${setup.inactiveDays} дня подряд)` : ""}`)
  if (metrics.meetings.withoutOutcome > 0) red.push("Встречи без итога больше 45 минут после начала")
  if (red.length > 0) return { level: "red", reasons: red }
  const yellow: string[] = []
  if (metrics.tasks.overdue > 0) yellow.push(`Просроченные задачи: ${metrics.tasks.overdue}`)
  if (metrics.hygiene.rescheduledNoDate > 0) yellow.push(`Переносы без даты: ${metrics.hygiene.rescheduledNoDate}`)
  if (yellow.length > 0) return { level: "yellow", reasons: yellow }
  return { level: "green", reasons: ["Отклонений нет"] }
}

/** Оценка дня (предложение ТЗ): 50 — результат к графику, 50 — дисциплина CRM */
function dayScore(plan: Plan, metrics: TodayMetrics, setup: ManagerSetup): TeamRow["dayScore"] {
  if (setup.absence || plan.expectedToDate === null || plan.expectedToDate === 0) return null
  const result = Math.min(plan.fact / plan.expectedToDate, 1) * 50
  const penalties = metrics.hygiene.withoutOutcome * 10 + metrics.hygiene.noNextStep * 4 + metrics.tasks.overdue * 4 + setup.inactiveDays * 25
  const total = result + Math.max(50 - penalties, 0)
  return total >= 90 ? 5 : total >= 75 ? 4 : total >= 60 ? 3 : 2
}

function buildRow(manager: (typeof demoManagers)[number]): TeamRow {
  const setup = SETUP[manager.id]
  const today = todayMetrics(manager.id, setup)
  const plan = buildPlan(setup)
  const { level, reasons } = dayLevel(today, setup)
  return { manager, level, reasons, absence: setup.absence, inactiveDays: setup.inactiveDays, dayScore: dayScore(plan, today, setup), today, plan }
}

function sumMetrics(items: readonly TodayMetrics[]): TodayMetrics {
  const sum = (pick: (metrics: TodayMetrics) => number) => items.reduce((total, metrics) => total + pick(metrics), 0)
  const nextTimes = items.flatMap((metrics) => (metrics.meetings.nextToConfirmAt ? [metrics.meetings.nextToConfirmAt] : [])).toSorted()
  const waits = items.flatMap((metrics) => (metrics.waitingReplies.maxWaitHours === null ? [] : [metrics.waitingReplies.maxWaitHours]))
  return {
    meetings: {
      total: sum((m) => m.meetings.total),
      confirmed: sum((m) => m.meetings.confirmed),
      toConfirm: sum((m) => m.meetings.toConfirm),
      nextToConfirmAt: nextTimes[0] ?? null,
      held: sum((m) => m.meetings.held),
      noShow: sum((m) => m.meetings.noShow),
      rescheduled: sum((m) => m.meetings.rescheduled),
      cancelled: sum((m) => m.meetings.cancelled),
      withoutOutcome: sum((m) => m.meetings.withoutOutcome),
    },
    payments: { count: sum((m) => m.payments.count), amount: addDecimals(items.map((m) => m.payments.amount)), currency: "KGS" },
    calls: {
      total: sum((m) => m.calls.total),
      answered: sum((m) => m.calls.answered),
      conversations: sum((m) => m.calls.conversations),
      minutes: sum((m) => m.calls.minutes),
    },
    waitingReplies: { count: sum((m) => m.waitingReplies.count), maxWaitHours: waits.length ? Math.max(...waits) : null },
    tasks: { today: sum((m) => m.tasks.today), overdue: sum((m) => m.tasks.overdue), unassigned: sum((m) => m.tasks.unassigned) },
    hygiene: {
      withoutOutcome: sum((m) => m.hygiene.withoutOutcome),
      rescheduledNoDate: sum((m) => m.hygiene.rescheduledNoDate),
      noNextStep: sum((m) => m.hygiene.noNextStep),
    },
  }
}

function departmentPlan(): Plan {
  const withPlan = Object.values(SETUP).filter((setup) => setup.target !== null)
  return buildPlan({
    target: withPlan.reduce((sum, setup) => sum + (setup.target ?? 0), 0),
    fact: Object.values(SETUP).reduce((sum, setup) => sum + setup.fact, 0),
    payments: [0, "0.00"],
    meetingToSale: 0.24,
    attendance: 0.55,
    absence: null,
    workDaysTotal: WORK_DAYS_TOTAL,
    workDaysLeft: WORK_DAYS_LEFT,
    inactiveDays: 0,
  })
}

function attentionFor(rows: readonly TeamRow[]): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const row of rows) {
    const { manager, today, plan } = row
    if (row.inactiveDays > 0) {
      items.push({ id: `idle-${manager.id}`, priority: "high", manager, problem: "нет активности в рабочий день", value: `${row.inactiveDays} дн. подряд`, target: "manager" })
    }
    if (today.meetings.withoutOutcome > 0) {
      items.push({ id: `outcome-${manager.id}`, priority: "high", manager, problem: "встречи без итога", value: String(today.hygiene.withoutOutcome), target: "meetings_outcome" })
    }
    if (today.meetings.toConfirm > 0) {
      items.push({
        id: `confirm-${manager.id}`,
        priority: today.meetings.toConfirm > 1 ? "high" : "medium",
        manager,
        problem: "встречи сегодня не подтверждены",
        value: String(today.meetings.toConfirm),
        target: "meetings",
      })
    }
    if (today.hygiene.noNextStep > 1) {
      items.push({ id: `step-${manager.id}`, priority: "medium", manager, problem: "сделки без следующего шага", value: String(today.hygiene.noNextStep), target: "leads_no_step" })
    }
    if (plan.expectedToDate !== null && plan.fact < plan.expectedToDate * 0.85 && !row.absence) {
      items.push({ id: `pace-${manager.id}`, priority: "medium", manager, problem: "отстаёт от темпа плана", value: `${plan.fact} из ${plan.expectedToDate.toLocaleString("ru-RU")} к сегодня`, target: "manager" })
    }
    if (today.tasks.overdue > 2) {
      items.push({ id: `tasks-${manager.id}`, priority: "medium", manager, problem: "просроченные задачи", value: String(today.tasks.overdue), target: "tasks" })
    }
  }
  // Сначала высокий приоритет; внутри — по очереди разные сотрудники, чтобы верх не занял один человек
  const rank = new Map<string, number>()
  const perManager = new Map<string, number>()
  for (const item of items) {
    const key = item.manager?.id ?? "department"
    const index = perManager.get(key) ?? 0
    rank.set(item.id, index)
    perManager.set(key, index + 1)
  }
  return items.toSorted((a, b) => {
    if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1
    return (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)
  })
}

export function demoTeamToday(): TeamToday {
  const rows = demoManagers.map(buildRow)
  return {
    asOf: DEMO_NOW,
    workDay: { number: WORK_DAYS_TOTAL - WORK_DAYS_LEFT + 1, total: WORK_DAYS_TOTAL, monthLabel: "Октябрь 2026" },
    attention: attentionFor(rows),
    rows,
    department: { today: sumMetrics(rows.map((row) => row.today)), plan: departmentPlan() },
  }
}

const PERIOD_FROM: Record<QualityPeriod, number> = { week: -6, month: -26 }

function callAggregates(managerId: string) {
  const calls = demoCalls.filter((call) => call.manager.id === managerId)
  const rated = calls.filter((call) => call.rating)
  const analyzed = calls.filter((call) => call.analysis)
  const withGoal = analyzed.filter((call) => call.analysis?.goal)
  return {
    total: calls.length,
    conversations: calls.filter((call) => call.status === "answered" && call.durationSec >= 30).length,
    rated: rated.length,
    avgScore: rated.length ? round1(rated.reduce((sum, call) => sum + (call.rating?.score ?? 0), 0) / rated.length) : null,
    goalAchievedShare: withGoal.length ? withGoal.filter((call) => call.analysis?.goal === "achieved").length / withGoal.length : null,
    nextStepShare: analyzed.length ? analyzed.filter((call) => call.analysis?.nextAction).length / analyzed.length : null,
  }
}

function toListen(managerId: string | null): TeamQuality["toListen"] {
  const rated = demoCalls.filter((call) => call.rating && (!managerId || call.manager.id === managerId))
  const byScore = rated.toSorted((a, b) => (a.rating?.score ?? 0) - (b.rating?.score ?? 0))
  const weak = byScore.filter((call) => (call.rating?.score ?? 5) <= 3).slice(0, 3)
  const strong = byScore.toReversed().filter((call) => (call.rating?.score ?? 0) >= 4).slice(0, 2)
  return [...weak.map((call) => ({ call, kind: "weak" as const })), ...strong.map((call) => ({ call, kind: "strong" as const }))].map(({ call, kind }) => ({
    callId: call.id,
    lead: call.lead,
    manager: call.manager,
    score: call.rating?.score ?? 1,
    kind,
    summary: call.analysis?.summary ?? "Разбора нет",
  }))
}

export function demoTeamQuality(period: QualityPeriod): TeamQuality {
  const from = demoDate(PERIOD_FROM[period])
  const inPeriod = demoMeetings.filter((meeting) => meeting.startsAt.slice(0, 10) >= from && meeting.startsAt.slice(0, 10) <= DEMO_TODAY)
  const deals = new Map(demoDeals.map((deal) => [deal.id, deal]))
  const isPaid = (leadId: string) => ["s-prepaid", "s-won"].includes(deals.get(leadId)?.stageId ?? "")
  const held = inPeriod.filter((meeting) => meeting.status === "held")
  return {
    period,
    periodLabel: period === "week" ? "Последние 7 дней" : "Октябрь 2026",
    meetings: {
      booked: inPeriod.length,
      confirmed: inPeriod.filter((meeting) => meeting.clientConfirmation === "confirmed").length,
      held: held.length,
      noShow: inPeriod.filter((meeting) => meeting.status === "no_show").length,
      cancelled: inPeriod.filter((meeting) => meeting.status === "cancelled").length,
      rescheduled: inPeriod.filter((meeting) => meeting.status === "rescheduled").length,
      withoutOutcome: inPeriod.filter((meeting) => meeting.outcomeRequired).length,
      heldWithPayment: held.filter((meeting) => isPaid(meeting.lead.id)).length,
    },
    heldWithoutSale: held
      .filter((meeting) => !isPaid(meeting.lead.id))
      .map((meeting) => ({
        lead: meeting.lead,
        manager: meeting.host,
        meetingAt: meeting.startsAt,
        stageName: stageName(deals.get(meeting.lead.id)?.stageId ?? ""),
        nextStep: deals.get(meeting.lead.id)?.nextAction?.title ?? null,
      })),
    calls: demoManagers.map((manager) => ({ manager, ...callAggregates(manager.id) })),
    toListen: toListen(null),
  }
}

const STALE_DAYS = 7

export function demoTeamFunnel(): TeamFunnel {
  return {
    staleThresholdDays: STALE_DAYS,
    pipelines: demoSalesConfig.pipelines.map((pipeline) => {
      const stages = pipeline.stages
        .filter((stage) => stage.kind === "open")
        .map((stage) => {
          const deals = demoDeals.filter((deal) => deal.stageId === stage.id)
          const ages = deals.map((deal) => hoursSince(deal.stageEnteredAt) / 24).toSorted((a, b) => a - b)
          const amounts = deals.flatMap((deal) => (deal.amount ? [deal.amount] : []))
          return {
            id: stage.id,
            name: stage.name,
            count: deals.length,
            amount: amounts.length ? addDecimals(amounts) : null,
            currency: amounts.length ? "KGS" : null,
            medianAgeDays: ages.length ? round1(ages[Math.floor(ages.length / 2)]) : null,
            staleCount: ages.filter((age) => age > STALE_DAYS).length,
            // Истории переходов в демо нет — конверсию не выдумываем
            conversionToNext: null,
            isPile: false,
          }
        })
      const maxCount = Math.max(...stages.map((stage) => stage.count))
      return {
        id: pipeline.id,
        name: pipeline.name,
        stages: stages.map((stage) => ({ ...stage, isPile: stage.count === maxCount && stage.count >= 4 && (stage.medianAgeDays ?? 0) >= 2 })),
      }
    }),
  }
}

/** Демо-ряд активности за 14 дней: детерминированный, чтобы страница не «прыгала» */
const ACTIVITY_PATTERN = [14, 0, 18, 22, 11, 16, 0, 19, 24, 15, 9, 21, 0, 12]

export function demoMemberCard(managerId: string): MemberCard | null {
  const manager = demoManagers.find((item) => item.id === managerId)
  if (!manager) return null
  const row = buildRow(manager)
  const setup = SETUP[managerId]
  const calls = callAggregates(managerId)
  const managerCalls = demoCalls.filter((call) => call.manager.id === managerId)
  const days = Array.from({ length: 14 }, (_, index) => demoDate(index - 13))
  const isWorkDay = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() !== 0

  const focusPoints = [
    row.today.hygiene.withoutOutcome > 0 && `Записывать итог встречи в течение 45 минут — сейчас без итога ${row.today.hygiene.withoutOutcome}`,
    row.today.hygiene.noNextStep > 0 && `Не оставлять сделки без следующего шага — таких ${row.today.hygiene.noNextStep}`,
    row.today.meetings.toConfirm > 0 && `Подтверждать встречи до 10:00 — сегодня не подтверждено ${row.today.meetings.toConfirm}`,
    calls.nextStepShare !== null && calls.nextStepShare < 0.7 && "Заканчивать разговор конкретной датой и временем следующего шага",
    row.plan.perDayNeeded !== null && row.plan.perDayNeeded > 1 && `Темп: нужно ${row.plan.perDayNeeded} продажи в день до конца месяца`,
  ].filter((point): point is string => Boolean(point))

  return {
    manager,
    periodLabel: "Последние 14 дней",
    absence: setup.absence,
    dayScores: days.map((date, index) => ({
      date,
      isWorkDay: isWorkDay(date),
      score: !isWorkDay(date) ? null : date === DEMO_TODAY ? row.dayScore : ([4, 3, 5, 4, 4, 3, 2, 4, 5, 3, 4, 4, 3, 4] as const)[index],
    })),
    plan: row.plan,
    paymentsAmount: setup.payments[1],
    currency: "KGS",
    activity: days.map((date, index) => ({
      date,
      isWorkDay: isWorkDay(date),
      calls: setup.inactiveDays > 0 && index >= 14 - setup.inactiveDays ? 0 : isWorkDay(date) ? ACTIVITY_PATTERN[index] : 0,
      conversations: setup.inactiveDays > 0 && index >= 14 - setup.inactiveDays ? 0 : isWorkDay(date) ? Math.round(ACTIVITY_PATTERN[index] * 0.45) : 0,
    })),
    discipline: {
      withoutOutcome: row.today.hygiene.withoutOutcome,
      noNextStep: row.today.hygiene.noNextStep,
      overdueTasks: row.today.tasks.overdue,
      rescheduledNoDate: row.today.hygiene.rescheduledNoDate,
    },
    callQuality:
      calls.rated === 0
        ? null
        : {
            rated: calls.rated,
            total: calls.total,
            distribution: [1, 2, 3, 4, 5].map((score) => ({ score, count: managerCalls.filter((call) => call.rating?.score === score).length })),
            goalAchievedShare: calls.goalAchievedShare,
            nextStepShare: calls.nextStepShare,
            gaps: managerCalls.flatMap((call) => call.analysis?.objections ?? []).map((label) => ({ label: `Возражение: ${label}`, count: 1 })),
          },
    focusPoints: focusPoints.slice(0, 5),
    dealsToPush: demoDeals
      .filter((deal) => deal.manager.id === managerId && OPEN_STAGES.has(deal.stageId))
      .toSorted((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0))
      .slice(0, 5)
      .map((deal) => ({ id: deal.id, title: deal.title, stageName: stageName(deal.stageId), amount: deal.amount, currency: deal.currency, nextStep: deal.nextAction?.title ?? null })),
    toListen: toListen(managerId),
  }
}
