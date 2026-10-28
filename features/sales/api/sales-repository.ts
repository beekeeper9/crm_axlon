import { isMockDataSource } from "@/config/env"
import {
  boardSchema,
  dealSchema,
  salesConfigSchema,
  type Board,
  type Deal,
  type SalesConfig,
} from "@/features/sales/schemas"
import { contractPending } from "@/lib/api/errors"
import { paginate, paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"
import { addDecimals } from "@/lib/decimal"
import { demoDeals, demoSalesConfig } from "@/mocks/crm"
import { simulateLatency } from "@/mocks/latency"

export type DealsFilter = {
  pipelineId: string
  /** null — все сделки, доступные пользователю (область own/team/all определяет backend) */
  managerId: string | null
  search: string | null
}

export type DealsListQuery = DealsFilter & PageParams & {
  stageId: string | null
}

export type SalesRepository = {
  /** Воронки, этапы и справочник причин отказа — настройки компании */
  getConfig(): Promise<SalesConfig>
  /** Доска воронки: рабочие этапы с количеством, суммой и сделками */
  getBoard(filter: DealsFilter): Promise<Board>
  /** Таблица сделок с пагинацией limit/offset */
  listDeals(query: DealsListQuery): Promise<Paginated<Deal>>
}

const dealsPageSchema = paginatedSchema(dealSchema)

function matchesFilter(deal: Deal, { pipelineId, managerId, search }: DealsFilter): boolean {
  if (deal.pipelineId !== pipelineId) return false
  if (managerId && deal.manager.id !== managerId) return false
  if (!search) return true
  const needle = search.toLocaleLowerCase("ru")
  return [deal.title, deal.client.phone ?? "", ...deal.tags].some((value) =>
    value.toLocaleLowerCase("ru").includes(needle)
  )
}

const mockSalesRepository: SalesRepository = {
  async getConfig() {
    await simulateLatency(200)
    return salesConfigSchema.parse(demoSalesConfig)
  },

  async getBoard(filter) {
    await simulateLatency(450)
    const pipeline = demoSalesConfig.pipelines.find((item) => item.id === filter.pipelineId)
    const deals = demoDeals.filter((deal) => matchesFilter(deal, filter))
    const columns = (pipeline?.stages ?? [])
      .filter((stage) => stage.kind === "open")
      .map((stage) => {
        const stageDeals = deals.filter((deal) => deal.stageId === stage.id)
        const amounts = stageDeals.flatMap((deal) => (deal.amount ? [deal.amount] : []))
        return {
          stageId: stage.id,
          count: stageDeals.length,
          totalAmount: amounts.length > 0 ? addDecimals(amounts) : null,
          currency: amounts.length > 0 ? "KGS" : null,
          deals: stageDeals,
        }
      })
    return boardSchema.parse({ pipelineId: filter.pipelineId, columns })
  },

  async listDeals({ stageId, limit, offset, ...filter }) {
    await simulateLatency(400)
    const deals = demoDeals
      .filter((deal) => matchesFilter(deal, filter))
      .filter((deal) => !stageId || deal.stageId === stageId)
      .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return dealsPageSchema.parse(paginate(deals, { limit, offset }))
  },
}

/** Endpoint не согласованы — см. docs/API_CONTRACT.md, раздел «Продажи». */
const httpSalesRepository: SalesRepository = {
  async getConfig() {
    return contractPending("настройки воронок")
  },
  async getBoard() {
    return contractPending("доска воронки")
  },
  async listDeals() {
    return contractPending("список сделок")
  },
}

export const salesRepository: SalesRepository = isMockDataSource
  ? mockSalesRepository
  : httpSalesRepository
