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

/** Сортировка таблицы; «-» в начале — по убыванию. Набор полей нужно согласовать с backend */
export const DEAL_SORTS = ["-updated", "updated", "-amount", "amount", "next_action", "title"] as const
export type DealSort = (typeof DEAL_SORTS)[number]

/** Быстрые фильтры «требует внимания»: флаги просрочки и следующего шага приходят от backend */
export type DealAttention = "overdue" | "no_next_step"

export type DealsListQuery = Omit<DealsFilter, "pipelineId"> &
  PageParams & {
    /** null — все воронки (раздел «Список») */
    pipelineId: string | null
    stageId: string | null
    attention: DealAttention | null
    sort: DealSort
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

function matchesFilter(
  deal: Deal,
  { pipelineId, managerId, search }: Omit<DealsFilter, "pipelineId"> & { pipelineId: string | null }
): boolean {
  if (pipelineId && deal.pipelineId !== pipelineId) return false
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

  async listDeals({ stageId, attention, sort, limit, offset, ...filter }) {
    await simulateLatency(400)
    const deals = demoDeals
      .filter((deal) => matchesFilter(deal, filter))
      .filter((deal) => !stageId || deal.stageId === stageId)
      .filter((deal) => attention !== "overdue" || deal.nextAction?.isOverdue === true)
      .filter((deal) => attention !== "no_next_step" || deal.nextAction === null)
      .toSorted(compareDeals(sort))
    return dealsPageSchema.parse(paginate(deals, { limit, offset }))
  },
}

/** Демо-сортировка; в реальном режиме сортирует backend */
function compareDeals(sort: DealSort): (a: Deal, b: Deal) => number {
  const direction = sort.startsWith("-") ? -1 : 1
  switch (sort) {
    case "amount":
    case "-amount":
      return (a, b) => direction * (Number(a.amount ?? -1) - Number(b.amount ?? -1))
    case "next_action":
      return (a, b) => (a.nextAction?.dueAt ?? "9999").localeCompare(b.nextAction?.dueAt ?? "9999")
    case "title":
      return (a, b) => a.title.localeCompare(b.title, "ru")
    default:
      return (a, b) => direction * a.updatedAt.localeCompare(b.updatedAt)
  }
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
