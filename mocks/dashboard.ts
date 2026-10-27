/**
 * ДЕМО-ДАННЫЕ главной страницы. Вымышленная команда, суммы условные.
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import type {
  AttentionList,
  ReportingPeriod,
  RevenueTrend,
  SalesFunnel,
  SalesSummary,
  TeamPerformance,
} from "@/features/dashboard/schemas"

/** Демо-«сегодня» зафиксировано, чтобы данные не менялись от запуска к запуску. */
const period: ReportingPeriod = {
  label: "Октябрь 2026",
  start: "2026-10-01",
  end: "2026-10-31",
  daysTotal: 31,
  daysElapsed: 27,
}

const TEAM_PLAN = 12_000_000
const TEAM_ACTUAL = 9_140_000

export const demoSalesSummary: SalesSummary = {
  period,
  revenue: { value: TEAM_ACTUAL, previous: 8_420_000, plan: TEAM_PLAN },
  wonDeals: { value: 36, previous: 33 },
  conversionRate: { value: 0.231, previous: 0.248 },
  averageDealSize: { value: 253_900, previous: 255_150 },
}

function buildRevenueTrend(): RevenueTrend["points"] {
  // Будни приносят больше выручки, чем выходные; рост к концу месяца.
  const weights: number[] = []
  for (let day = 1; day <= period.daysElapsed; day += 1) {
    const weekday = new Date(Date.UTC(2026, 9, day)).getUTCDay()
    const isWeekend = weekday === 0 || weekday === 6
    weights.push((isWeekend ? 0.35 : 1) * (1 + day / 60) * (day % 3 === 0 ? 1.25 : 1))
  }
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)

  let cumulative = 0
  return Array.from({ length: period.daysTotal }, (_, index) => {
    const day = index + 1
    const date = `2026-10-${String(day).padStart(2, "0")}`
    const plan = Math.round((TEAM_PLAN / period.daysTotal) * day)
    if (day > period.daysElapsed) return { date, actual: null, plan }

    cumulative += (weights[index] / totalWeight) * TEAM_ACTUAL
    return { date, actual: Math.round(cumulative), plan }
  })
}

export const demoRevenueTrend: RevenueTrend = {
  period,
  plan: TEAM_PLAN,
  points: buildRevenueTrend(),
}

export const demoTeamPerformance: TeamPerformance = {
  period,
  members: [
    { managerId: "m-1", managerName: "Айбек Садыков", plan: 2_400_000, actual: 2_310_000, wonDeals: 9, conversionRate: 0.31, overdueTasks: 0 },
    { managerId: "m-2", managerName: "Нурлан Абдыкадыров", plan: 2_200_000, actual: 1_980_000, wonDeals: 8, conversionRate: 0.28, overdueTasks: 1 },
    { managerId: "m-3", managerName: "Мария Орлова", plan: 2_000_000, actual: 1_610_000, wonDeals: 7, conversionRate: 0.24, overdueTasks: 2 },
    { managerId: "m-4", managerName: "Бакыт Токтогулов", plan: 2_000_000, actual: 1_420_000, wonDeals: 5, conversionRate: 0.2, overdueTasks: 4 },
    { managerId: "m-5", managerName: "Динара Асанова", plan: 1_800_000, actual: 1_090_000, wonDeals: 4, conversionRate: 0.17, overdueTasks: 6 },
    { managerId: "m-6", managerName: "Тимур Ли", plan: 1_600_000, actual: 730_000, wonDeals: 3, conversionRate: 0.14, overdueTasks: 3 },
  ],
}

export const demoSalesFunnel: SalesFunnel = {
  pipelineName: "Основная воронка",
  stages: [
    { id: "lead", name: "Новый лид", dealsCount: 156, amount: 40_600_000, conversionToNext: 0.72, averageDaysInStage: 1.2 },
    { id: "qualification", name: "Квалификация", dealsCount: 112, amount: 29_100_000, conversionToNext: 0.7, averageDaysInStage: 2.9 },
    { id: "proposal", name: "КП отправлено", dealsCount: 78, amount: 20_300_000, conversionToNext: 0.53, averageDaysInStage: 7.4 },
    { id: "negotiation", name: "Переговоры", dealsCount: 41, amount: 10_900_000, conversionToNext: 0.93, averageDaysInStage: 4.6 },
    { id: "contract", name: "Договор и оплата", dealsCount: 38, amount: 9_700_000, conversionToNext: 0.95, averageDaysInStage: 3.1 },
    { id: "won", name: "Успешно", dealsCount: 36, amount: TEAM_ACTUAL, conversionToNext: null, averageDaysInStage: 0 },
  ],
}

export const demoAttentionList: AttentionList = {
  items: [
    {
      id: "a-1",
      kind: "behind_plan",
      severity: "high",
      title: "Тимур Ли отстаёт от плана",
      description: "Выполнено 46 % плана при ожидаемых 87 % на сегодня.",
    },
    {
      id: "a-2",
      kind: "stalled_deal",
      severity: "high",
      title: "7 сделок без движения больше 10 дней",
      description: "Этап «КП отправлено», общая сумма 3,4 млн сом.",
    },
    {
      id: "a-3",
      kind: "overdue_tasks",
      severity: "medium",
      title: "16 просроченных задач в команде",
      description: "Больше всего у Динары Асановой — 6 задач.",
    },
    {
      id: "a-4",
      kind: "no_next_step",
      severity: "medium",
      title: "5 сделок без следующего шага",
      description: "Не назначены задача или встреча — сделки могут потеряться.",
    },
  ],
}
