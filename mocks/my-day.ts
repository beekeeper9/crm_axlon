/**
 * ДЕМО-ДАННЫЕ «Мой день» для вымышленного менеджера (Айбек Садыков, m-1).
 * Цифры согласованы с демо-таблицей команды в mocks/dashboard.ts.
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import type {
  Earnings,
  NowSummary,
  PersonalKpis,
  PersonalTurnover,
  ReportingPeriod,
  SalesSegments,
} from "@/features/dashboard/schemas"

const period: ReportingPeriod = {
  label: "Октябрь 2026",
  start: "2026-10-01",
  end: "2026-10-31",
  daysTotal: 31,
  daysElapsed: 27,
}

const PLAN = 2_400_000
const TURNOVER = 2_310_000

export const demoNowSummary: NowSummary = {
  awaitingReply: 1,
  meetingsToday: { held: 2, total: 6 },
  meetingsWithoutOutcome: 3,
  reschedulesWithoutDate: 4,
  tasks: { overdue: 5, dueToday: 11 },
}

/** Оплаты приходят неравномерно: в отдельные дни, по 1–2 сделки */
const PAYMENT_DAYS: Record<number, [amount: number, sales: number]> = {
  2: [180_000, 1],
  6: [240_000, 1],
  9: [310_000, 1],
  13: [220_000, 1],
  15: [150_000, 1],
  20: [420_000, 1],
  22: [260_000, 1],
  24: [280_000, 1],
  27: [250_000, 1],
}

function buildPoints(): PersonalTurnover["points"] {
  let cumulative = 0
  return Array.from({ length: period.daysTotal }, (_, index) => {
    const day = index + 1
    const date = `2026-10-${String(day).padStart(2, "0")}`
    const plan = Math.round((PLAN / period.daysTotal) * day)
    if (day > period.daysElapsed) {
      return { date, cumulative: null, plan, dailyTurnover: null, dailySales: null }
    }
    const [amount, sales] = PAYMENT_DAYS[day] ?? [0, 0]
    cumulative += amount
    return { date, cumulative, plan, dailyTurnover: amount, dailySales: sales }
  })
}

export const demoPersonalTurnover: PersonalTurnover = {
  period,
  turnover: TURNOVER,
  plan: PLAN,
  planToDate: 2_090_300,
  forecast: 2_652_200,
  growth: { value: 340_000, comparedTo: "2026-09-27" },
  prepayments: 1_890_000,
  additionalPayments: 420_000,
  points: buildPoints(),
}

export const demoEarnings: Earnings = {
  total: 145_500,
  notice: null,
  lines: [
    { label: "Оклад", amount: 30_000, note: null },
    { label: "Бонус 5 % с оборота", amount: 115_500, note: "оборот 2 310 000 сом" },
  ],
  footnote: "Расчёт по правилам мотивации компании. Итог фиксируется после закрытия месяца.",
}

export const demoPersonalKpis: PersonalKpis = {
  sales: { value: 9, previous: 7, plan: null },
  salesPerMeeting: { ratio: 0.31, sales: 9, meetingsHeld: 29, bonusThreshold: 0.25 },
  averageDeal: { value: 256_700, note: "оборот ÷ продажи" },
  meetings: { held: 29, attendanceRate: 0.62, upcoming: 6 },
  monthFunnel: { assigned: 52, passed: 47, held: 29, sales: 9 },
}

export const demoSalesSegments: SalesSegments = {
  segments: [
    {
      id: "new",
      name: "Новые клиенты",
      sales: { value: 6, previous: 5 },
      turnover: 1_480_000,
      prepayments: 1_200_000,
      additionalPayments: 280_000,
      averageDeal: 246_700,
      share: 0.64,
    },
    {
      id: "repeat",
      name: "Повторные продажи",
      sales: { value: 3, previous: 2 },
      turnover: 830_000,
      prepayments: 690_000,
      additionalPayments: 140_000,
      averageDeal: 276_700,
      share: 0.36,
    },
  ],
}
