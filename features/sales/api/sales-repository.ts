import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import {
  boardSchema,
  dealSchema,
  salesConfigSchema,
  stageKindSchema,
  type Board,
  type BoardColumn,
  type Deal,
  type Pipeline,
  type SalesConfig,
} from "@/features/sales/schemas"
import { loadMemberNames } from "@/features/team"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"
import { paginate, paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { addDecimals } from "@/lib/decimal"
import { demoDeals, demoSalesConfig } from "@/mocks/crm"
import { simulateLatency } from "@/mocks/latency"
import { demoScopedManagerId } from "@/mocks/scope"

export type DealsFilter = {
  pipelineId: string
  /** null — все сделки, доступные пользователю (область own/team/all определяет backend) */
  managerId: string | null
  search: string | null
}

/** Сортировка таблицы; «-» в начале — по убыванию. Только поля, которые сортирует backend */
export const DEAL_SORTS = ["-updated", "updated", "-amount", "amount", "title"] as const
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
  return [deal.title, deal.client?.phone ?? "", ...deal.tags].some((value) =>
    value.toLocaleLowerCase("ru").includes(needle)
  )
}

const mockSalesRepository: SalesRepository = {
  async getConfig() {
    await simulateLatency(200)
    return salesConfigSchema.parse(demoSalesConfig)
  },

  async getBoard(requested) {
    await simulateLatency(450)
    const filter = { ...requested, managerId: await demoScopedManagerId(requested.managerId) }
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

  async listDeals({ stageId, attention, sort, limit, offset, ...requested }) {
    await simulateLatency(400)
    const filter = { ...requested, managerId: await demoScopedManagerId(requested.managerId) }
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
    case "title":
      return (a, b) => a.title.localeCompare(b.title, "ru")
    default:
      return (a, b) => direction * (a.updatedAt ?? "").localeCompare(b.updatedAt ?? "")
  }
}

/** Ответы backend (`/api/v1/sales/…`, ветка P0); имена полей уже в camelCase */
const backendPipelineSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  stages: z.array(
    z.object({ id: z.string(), name: z.string(), position: z.int(), kind: stageKindSchema, isActive: z.boolean() })
  ),
})

const backendLossReasonsSchema = paginatedSchema(
  z.object({ id: z.string(), name: z.string(), isActive: z.boolean() })
)

const backendDealSchema = z.object({
  id: z.string(),
  title: z.string(),
  amount: decimalStringSchema,
  currency: currencyCodeSchema,
  pipelineId: z.string(),
  stageId: z.string(),
  ownerUserId: z.string(),
  nextStep: z.string().nullable(),
  /** Последнее изменение записи; старый backend поля не отдаёт */
  updatedAt: z.iso.datetime({ offset: true }).nullable().optional(),
})

const backendDealsPageSchema = paginatedSchema(backendDealSchema)
type BackendDeal = z.infer<typeof backendDealSchema>

/** Сделок в колонке доски за один запрос; остальные видны в таблице */
const BOARD_STAGE_LIMIT = 50

const BACKEND_ORDERING: Record<DealSort, string> = {
  "-updated": "-updated_at",
  updated: "updated_at",
  "-amount": "-amount",
  amount: "amount",
  title: "title",
}

/**
 * Список сделок backend отдаёт без клиента, даты смены этапа и срока
 * следующего шага — эти поля остаются пустыми, а не придумываются (см. docs/API_CONTRACT.md).
 */
function toDeal(deal: BackendDeal, memberNames: ReadonlyMap<string, string>): Deal {
  return {
    id: deal.id,
    title: deal.title,
    client: null,
    pipelineId: deal.pipelineId,
    stageId: deal.stageId,
    amount: deal.amount,
    currency: deal.currency,
    manager: { id: deal.ownerUserId, name: memberNames.get(deal.ownerUserId) ?? "Сотрудник" },
    nextAction: deal.nextStep ? { title: deal.nextStep, dueAt: null, isOverdue: false } : null,
    stageEnteredAt: null,
    updatedAt: deal.updatedAt ?? null,
    tags: [],
  }
}

/** Только активные этапы, по порядку. Схема интерфейса требует хотя бы один этап — проверяет вызывающий */
function toPipeline(pipeline: z.infer<typeof backendPipelineSchema>): Pipeline {
  const stages = pipeline.stages
    .filter((stage) => stage.isActive)
    .toSorted((a, b) => a.position - b.position)
    .map(({ id, name, kind }) => ({ id, name, kind }))
  return { id: pipeline.id, name: pipeline.name, stages }
}

/** Одна воронка с активными этапами (список этапов может оказаться пустым) */
export async function fetchPipeline(auth: ApiAuth, pipelineId: string): Promise<Pipeline> {
  const pipeline = await apiRequest(`/api/v1/sales/pipelines/${encodeURIComponent(pipelineId)}/`, {
    auth,
    schema: backendPipelineSchema,
  })
  return toPipeline(pipeline)
}

type DealsRequest = {
  pipelineId: string | null
  stageId: string | null
  managerId: string | null
  search: string | null
  status?: "open"
  attention?: DealAttention | null
  ordering: string
  limit: number
  offset: number
}

function requestDeals(auth: ApiAuth, query: DealsRequest) {
  return apiRequest("/api/v1/sales/deals/", { auth, query, schema: backendDealsPageSchema })
}

const httpSalesRepository: SalesRepository = {
  async getConfig() {
    const auth = await getRenderAuth()
    const [pipelines, lossReasons] = await Promise.all([
      apiRequest("/api/v1/sales/pipelines/", { auth, schema: z.array(backendPipelineSchema) }),
      apiRequest("/api/v1/sales/loss-reasons/", { auth, query: { active: true }, schema: backendLossReasonsSchema }),
    ])
    // Воронка по умолчанию — первой: её доска открывается без выбора
    const ordered = pipelines.toSorted((a, b) => Number(b.isDefault) - Number(a.isDefault))
    return {
      pipelines: ordered.map(toPipeline).filter((pipeline) => pipeline.stages.length > 0),
      lossReasons: lossReasons.results.map(({ id, name }) => ({ id, label: name })),
    }
  },

  /**
   * Отдельного endpoint доски нет: по запросу на каждый рабочий этап, count — сколько сделок
   * на этапе всего. Суммы этапов backend не считает, поэтому totalAmount пустой.
   */
  async getBoard({ pipelineId, managerId, search }) {
    const auth = await getRenderAuth()
    const [pipeline, memberNames] = await Promise.all([fetchPipeline(auth, pipelineId), loadMemberNames()])
    if (pipeline.stages.length === 0) throw new ApiError("not_found", "В воронке нет активных этапов")
    const columns = await Promise.all(
      pipeline.stages
        .filter((stage) => stage.kind === "open")
        .map(async (stage): Promise<BoardColumn> => {
          const page = await requestDeals(auth, {
            pipelineId,
            stageId: stage.id,
            managerId,
            search,
            status: "open",
            ordering: BACKEND_ORDERING["-updated"],
            limit: BOARD_STAGE_LIMIT,
            offset: 0,
          })
          return {
            stageId: stage.id,
            count: page.count,
            totalAmount: null,
            currency: null,
            deals: page.results.map((deal) => toDeal(deal, memberNames)),
          }
        })
    )
    return { pipelineId, columns }
  },

  async listDeals({ sort, ...query }) {
    const auth = await getRenderAuth()
    const [page, memberNames] = await Promise.all([
      requestDeals(auth, { ...query, ordering: BACKEND_ORDERING[sort] }),
      loadMemberNames(),
    ])
    return { count: page.count, results: page.results.map((deal) => toDeal(deal, memberNames)) }
  },
}

export const salesRepository: SalesRepository = isMockDataSource
  ? mockSalesRepository
  : httpSalesRepository
