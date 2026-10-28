import { isMockDataSource } from "@/config/env"
import {
  attentionListSchema,
  earningsSchema,
  nowSummarySchema,
  personalKpisSchema,
  personalTurnoverSchema,
  revenueTrendSchema,
  salesSegmentsSchema,
  salesFunnelSchema,
  salesSummarySchema,
  teamPerformanceSchema,
  type AttentionList,
  type Earnings,
  type NowSummary,
  type PersonalKpis,
  type PersonalTurnover,
  type RevenueTrend,
  type SalesSegments,
  type SalesFunnel,
  type SalesSummary,
  type TeamPerformance,
} from "@/features/dashboard/schemas"
import { contractPending } from "@/lib/api/errors"
import {
  demoAttentionList,
  demoRevenueTrend,
  demoSalesFunnel,
  demoSalesSummary,
  demoTeamPerformance,
} from "@/mocks/dashboard"
import {
  demoEarnings,
  demoNowSummary,
  demoPersonalKpis,
  demoPersonalTurnover,
  demoSalesSegments,
} from "@/mocks/my-day"
import { simulateLatency } from "@/mocks/latency"

/** Все данные главной страницы. Виджеты не знают, откуда пришли данные. */
export type DashboardRepository = {
  getSalesSummary(): Promise<SalesSummary>
  getRevenueTrend(): Promise<RevenueTrend>
  getTeamPerformance(): Promise<TeamPerformance>
  getSalesFunnel(): Promise<SalesFunnel>
  getAttentionList(): Promise<AttentionList>
  /* «Мой день» — данные текущего пользователя */
  getNowSummary(): Promise<NowSummary>
  getPersonalTurnover(): Promise<PersonalTurnover>
  getEarnings(): Promise<Earnings>
  getPersonalKpis(): Promise<PersonalKpis>
  getSalesSegments(): Promise<SalesSegments>
}

/** Демо-данные проходят те же схемы, что и ответы API, чтобы не разойтись с контрактом. */
const mockDashboardRepository: DashboardRepository = {
  async getSalesSummary() {
    await simulateLatency(300)
    return salesSummarySchema.parse(demoSalesSummary)
  },
  async getRevenueTrend() {
    await simulateLatency(600)
    return revenueTrendSchema.parse(demoRevenueTrend)
  },
  async getTeamPerformance() {
    await simulateLatency(500)
    return teamPerformanceSchema.parse(demoTeamPerformance)
  },
  async getSalesFunnel() {
    await simulateLatency(700)
    return salesFunnelSchema.parse(demoSalesFunnel)
  },
  async getAttentionList() {
    await simulateLatency(400)
    return attentionListSchema.parse(demoAttentionList)
  },
  async getNowSummary() {
    await simulateLatency(250)
    return nowSummarySchema.parse(demoNowSummary)
  },
  async getPersonalTurnover() {
    await simulateLatency(400)
    return personalTurnoverSchema.parse(demoPersonalTurnover)
  },
  async getEarnings() {
    await simulateLatency(450)
    return earningsSchema.parse(demoEarnings)
  },
  async getPersonalKpis() {
    await simulateLatency(350)
    return personalKpisSchema.parse(demoPersonalKpis)
  },
  async getSalesSegments() {
    await simulateLatency(600)
    return salesSegmentsSchema.parse(demoSalesSegments)
  },
}

/**
 * Endpoints не согласованы — предложение в docs/API_CONTRACT.md, раздел «Главная».
 * После согласования каждый метод вызывает apiRequest() со схемой из ../schemas.
 */
const httpDashboardRepository: DashboardRepository = {
  async getSalesSummary() {
    return contractPending("сводка продаж за период")
  },
  async getRevenueTrend() {
    return contractPending("динамика выручки по дням")
  },
  async getTeamPerformance() {
    return contractPending("показатели менеджеров")
  },
  async getSalesFunnel() {
    return contractPending("воронка продаж по этапам")
  },
  async getAttentionList() {
    return contractPending("список «требует внимания»")
  },
  async getNowSummary() {
    return contractPending("плитки «Сейчас» для «Мой день»")
  },
  async getPersonalTurnover() {
    return contractPending("личный оборот за период")
  },
  async getEarnings() {
    return contractPending("заработок менеджера за месяц")
  },
  async getPersonalKpis() {
    return contractPending("личные показатели месяца")
  },
  async getSalesSegments() {
    return contractPending("продажи по направлениям")
  },
}

export const dashboardRepository: DashboardRepository = isMockDataSource
  ? mockDashboardRepository
  : httpDashboardRepository
