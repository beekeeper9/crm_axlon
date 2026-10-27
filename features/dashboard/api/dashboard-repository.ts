import { isMockDataSource } from "@/config/env"
import {
  attentionListSchema,
  revenueTrendSchema,
  salesFunnelSchema,
  salesSummarySchema,
  teamPerformanceSchema,
  type AttentionList,
  type RevenueTrend,
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
import { simulateLatency } from "@/mocks/latency"

/** Все данные главной страницы. Виджеты не знают, откуда пришли данные. */
export type DashboardRepository = {
  getSalesSummary(): Promise<SalesSummary>
  getRevenueTrend(): Promise<RevenueTrend>
  getTeamPerformance(): Promise<TeamPerformance>
  getSalesFunnel(): Promise<SalesFunnel>
  getAttentionList(): Promise<AttentionList>
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
}

export const dashboardRepository: DashboardRepository = isMockDataSource
  ? mockDashboardRepository
  : httpDashboardRepository
