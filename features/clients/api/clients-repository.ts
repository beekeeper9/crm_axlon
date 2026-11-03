import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { clientDetailSchema, clientSummarySchema, type ClientDeal, type ClientDetail, type ClientSummary } from "@/features/clients/schemas"
import { stageKindSchema } from "@/features/sales"
import { loadMemberNames } from "@/features/team"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { ownerChangeSchema, ownerChangeText } from "@/lib/api/owner-change"
import { ApiError } from "@/lib/api/errors"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"
import { PAGE_LIMIT_MAX, paginate, paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { demoClients, toClientSummary } from "@/mocks/clients"
import { simulateLatency } from "@/mocks/latency"
import { demoOwnScope, demoScopedManagerId } from "@/mocks/scope"

/** active — клиенты в работе; archive — переведённые в архив (в демо — все сделки закрыты) */
export type ClientStatus = "active" | "archive"

export type ClientsQuery = PageParams & {
  /** Поиск по имени и телефону по всей истории, включая архив */
  search: string | null
  status: ClientStatus | null
  managerId: string | null
}

export type ClientsRepository = {
  listClients(query: ClientsQuery): Promise<Paginated<ClientSummary>>
  /** null — клиент не найден или недоступен */
  getClient(clientId: string): Promise<ClientDetail | null>
}

const clientsPageSchema = paginatedSchema(clientSummarySchema)

/** Телефон ищем по цифрам: «555 10 20» находит «+996 555 10-20-31» */
function digits(value: string): string {
  return value.replace(/\D/g, "")
}

const mockClientsRepository: ClientsRepository = {
  async listClients({ search, status, managerId: requested, limit, offset }) {
    await simulateLatency(400)
    const managerId = await demoScopedManagerId(requested)
    const needle = search?.toLocaleLowerCase("ru") ?? ""
    const needleDigits = search ? digits(search) : ""
    const clients = demoClients
      .filter((client) => !status || (status === "active" ? client.openDealsCount > 0 : client.openDealsCount === 0))
      .filter((client) => !managerId || client.manager?.id === managerId)
      .filter(
        (client) =>
          !search ||
          client.name.toLocaleLowerCase("ru").includes(needle) ||
          (needleDigits.length >= 3 && client.phones.some((phone) => digits(phone).includes(needleDigits)))
      )
      .toSorted((a, b) => (b.lastInteractionAt ?? "").localeCompare(a.lastInteractionAt ?? ""))
      .map(toClientSummary)
    return clientsPageSchema.parse(paginate(clients, { limit, offset }))
  },

  async getClient(clientId) {
    await simulateLatency(300)
    const [client, ownScope] = [demoClients.find((item) => item.id === clientId), await demoOwnScope()]
    if (!client || (ownScope && client.manager?.id !== ownScope)) return null
    return clientDetailSchema.parse(client)
  },
}

/** Endpoint не согласованы — см. docs/API_CONTRACT.md, раздел «База клиентов». */
/** `GET /api/v1/customers/` — имена полей уже в camelCase */
const backendCustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  ownerUserId: z.string(),
  archivedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  /** Карточка-дубль, объединённая с другой: остаётся в архиве как история */
  mergedIntoId: z.string().nullable().optional(),
  version: z.int().optional(),
  createdAt: z.iso.datetime({ offset: true }),
})

const backendClientDealSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["open", "won", "lost"]),
  amount: decimalStringSchema,
  currency: currencyCodeSchema,
  pipelineId: z.string(),
  stageId: z.string(),
  closedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }).nullable().optional(),
})

/** `GET /customers/{id}/history/` — журнал изменений; передача называет прежнего и нового ответственного */
const backendCustomerHistorySchema = z.object({
  results: z.array(
    z.object({
      action: z.string(),
      occurredAt: z.iso.datetime({ offset: true }),
      actor: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
      details: ownerChangeSchema,
    })
  ),
})

const CUSTOMER_HISTORY_TITLES: Record<string, string> = {
  "customer.created": "Клиент создан",
  "customer.updated": "Данные изменены",
  "customer.archived": "Перенесён в архив",
  "customer.restored": "Возвращён из архива",
  "customer.reassigned": "Передан другому сотруднику",
  "customer.merged": "Присоединена карточка-дубль",
  "customer.merged_into": "Объединён с другой карточкой",
}

const backendActivitySchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  occurredAt: z.iso.datetime({ offset: true }).nullable().optional(),
  createdAt: z.iso.datetime({ offset: true }),
})

type BackendCustomer = z.infer<typeof backendCustomerSchema>
type StageInfo = { name: string; kind: ClientDeal["stageKind"]; pipelineName: string }

const ACTIVITY_LABELS: Record<string, string> = { task: "Задача", call: "Звонок", note: "Заметка" }

async function stageDirectory(auth: ApiAuth): Promise<Map<string, StageInfo>> {
  const pipelines = await apiRequest("/api/v1/sales/pipelines/", {
    auth,
    schema: z.array(z.object({ name: z.string(), stages: z.array(z.object({ id: z.string(), name: z.string(), kind: stageKindSchema })) })),
  })
  return new Map(pipelines.flatMap((p) => p.stages.map((stage) => [stage.id, { name: stage.name, kind: stage.kind, pipelineName: p.name }] as const)))
}

/** Сделки одного клиента (backend фильтрует по customer_id в области видимости пользователя) */
async function clientDeals(auth: ApiAuth, customerId: string, stages: Map<string, StageInfo>): Promise<ClientDeal[]> {
  const page = await apiRequest("/api/v1/sales/deals/", {
    auth,
    query: { customerId, limit: PAGE_LIMIT_MAX, ordering: "-created_at" },
    schema: paginatedSchema(backendClientDealSchema),
  })
  return page.results.map((deal) => {
    const stage = stages.get(deal.stageId)
    return {
      id: deal.id,
      title: deal.title,
      pipelineName: stage?.pipelineName ?? "Воронка",
      stageName: stage?.name ?? "Этап",
      stageKind: deal.status === "open" ? (stage?.kind ?? "open") : deal.status,
      amount: deal.amount,
      currency: deal.currency,
      updatedAt: deal.updatedAt ?? deal.closedAt ?? deal.createdAt,
    }
  })
}

function toSummary(customer: BackendCustomer, deals: ClientDeal[], names: ReadonlyMap<string, string>): ClientSummary {
  const open = deals.filter((deal) => deal.stageKind === "open")
  const current = open[0] ?? null
  return {
    id: customer.id,
    name: customer.name,
    phones: customer.phone ? [customer.phone] : [],
    email: customer.email,
    city: null,
    manager: { id: customer.ownerUserId, name: names.get(customer.ownerUserId) ?? "Сотрудник" },
    openDealsCount: open.length,
    dealsCount: deals.length,
    currentDeal: current && { id: current.id, stageName: current.stageName },
    // Последнее известное движение по клиенту — по его сделкам; без сделок — не выдумываем
    lastInteractionAt: deals.map((deal) => deal.updatedAt).toSorted().at(-1) ?? null,
    isArchived: Boolean(customer.archivedAt),
    mergedIntoId: customer.mergedIntoId ?? null,
  }
}

const ARCHIVED_PARAM: Record<ClientStatus, string> = { active: "false", archive: "true" }

const httpClientsRepository: ClientsRepository = {
  async listClients({ search, status, managerId, limit, offset }) {
    const auth = await getRenderAuth()
    const [page, stages, names] = await Promise.all([
      apiRequest("/api/v1/customers/", {
        auth,
        query: { search, ownerId: managerId, archived: status ? ARCHIVED_PARAM[status] : "all", ordering: "-created_at", limit, offset },
        schema: paginatedSchema(backendCustomerSchema),
      }),
      stageDirectory(auth),
      loadMemberNames(),
    ])
    // Сводка по сделкам — запросом на клиента текущей страницы (агрегата у backend нет)
    const deals = await Promise.all(page.results.map((customer) => clientDeals(auth, customer.id, stages)))
    return {
      count: page.count,
      results: page.results.map((customer, index) => toSummary(customer, deals[index] ?? [], names)),
    }
  },

  async getClient(clientId) {
    const auth = await getRenderAuth()
    let customer: BackendCustomer
    try {
      customer = await apiRequest(`/api/v1/customers/${encodeURIComponent(clientId)}/`, { auth, schema: backendCustomerSchema })
    } catch (error) {
      if (error instanceof ApiError && error.kind === "not_found") return null
      throw error
    }
    const [stages, names, activity, history] = await Promise.all([
      stageDirectory(auth),
      loadMemberNames(),
      apiRequest("/api/v1/activities/", {
        auth,
        query: { subjectType: "customer", subjectId: clientId, limit: 10 },
        schema: paginatedSchema(backendActivitySchema),
      }),
      apiRequest(`/api/v1/customers/${encodeURIComponent(clientId)}/history/`, { auth, schema: backendCustomerHistorySchema }),
    ])
    const deals = await clientDeals(auth, clientId, stages)
    return clientDetailSchema.parse({
      ...toSummary(customer, deals, names),
      deals,
      recentActivity: activity.results.map((item) => ({
        id: item.id,
        at: item.occurredAt ?? item.createdAt,
        title: [ACTIVITY_LABELS[item.kind] ?? "Событие", item.title ?? item.body].filter(Boolean).join(": "),
        dealTitle: customer.name,
      })),
      history: history.results.map((entry, index) => {
        const transfer = ownerChangeText(entry.details)
        return {
          id: `${entry.occurredAt}-${index}`,
          at: entry.occurredAt,
          title: [CUSTOMER_HISTORY_TITLES[entry.action] ?? entry.action, transfer].filter(Boolean).join(": "),
          author: entry.actor?.name ?? null,
        }
      }),
    })
  },
}

export const clientsRepository: ClientsRepository = isMockDataSource ? mockClientsRepository : httpClientsRepository

/** `POST /customers/` → id нового клиента; ответственный — автор (backend) */
export async function createCustomer(auth: ApiAuth, input: { name: string; phone: string | null; email: string | null }): Promise<string> {
  const created = await apiRequest("/api/v1/customers/", {
    method: "POST",
    auth,
    body: { name: input.name, ...(input.phone ? { phone: input.phone } : {}), ...(input.email ? { email: input.email } : {}) },
    schema: backendCustomerSchema,
  })
  return created.id
}

/** Архив и восстановление: `POST /customers/{id}/archive|restore/` */
export async function setCustomerArchived(auth: ApiAuth, customerId: string, archived: boolean): Promise<void> {
  await apiRequest(`/api/v1/customers/${encodeURIComponent(customerId)}/${archived ? "archive" : "restore"}/`, {
    method: "POST",
    auth,
    schema: backendCustomerSchema,
  })
}

/** Смена ответственного: менеджер не может, РОП — в своём отделе, директор — в компании (backend) */
export async function assignCustomer(auth: ApiAuth, customerId: string, ownerUserId: string): Promise<void> {
  await apiRequest(`/api/v1/customers/${encodeURIComponent(customerId)}/assign/`, {
    method: "POST",
    auth,
    body: { ownerUserId },
    schema: backendCustomerSchema,
  })
}

/** Новая сделка клиента (в том числе повторная — это отдельная продажа); этап — первый этап воронки */
export async function createCustomerDeal(
  auth: ApiAuth,
  input: { customerId: string; title: string; amount: string; pipelineId: string | null }
): Promise<string> {
  const created = await apiRequest("/api/v1/sales/deals/", {
    method: "POST",
    auth,
    body: {
      title: input.title,
      amount: input.amount,
      customerId: input.customerId,
      ...(input.pipelineId ? { pipelineId: input.pipelineId } : {}),
    },
    schema: z.object({ id: z.string() }),
  })
  return created.id
}

/** `PATCH /customers/{id}/` — имя и контакты; пустая строка очищает телефон или e-mail */
export async function updateCustomer(auth: ApiAuth, customerId: string, input: { name: string; phone: string; email: string }): Promise<void> {
  await apiRequest(`/api/v1/customers/${encodeURIComponent(customerId)}/`, {
    method: "PATCH",
    auth,
    body: input,
    schema: backendCustomerSchema,
  })
}

/** Заметка в истории клиента: `POST /activities/` с kind=note на клиенте */
export async function addCustomerNote(auth: ApiAuth, customerId: string, body: string): Promise<void> {
  await apiRequest("/api/v1/activities/", {
    method: "POST",
    auth,
    body: { kind: "note", subjectType: "customer", subjectId: customerId, body },
    schema: z.unknown(),
  })
}

export type ClientOption = { id: string; name: string; phone: string | null; email: string | null }

/** Поиск карточек по имени или телефону — для выбора дубля и привязки звонка */
export async function searchCustomers(auth: ApiAuth, search: string, archived: "false" | "all" = "false"): Promise<ClientOption[]> {
  const page = await apiRequest("/api/v1/customers/", {
    auth,
    query: { search, archived, limit: 10 },
    schema: paginatedSchema(backendCustomerSchema),
  })
  return page.results.map((customer) => ({ id: customer.id, name: customer.name, phone: customer.phone, email: customer.email }))
}

const mergePlanSchema = z.object({
  target: backendCustomerSchema,
  source: backendCustomerSchema,
  references: z.record(z.string(), z.int().nonnegative()),
  fills: z.array(z.string()),
})

export type MergePlan = {
  /** Сколько записей каждого вида перейдёт к основной карточке */
  references: Record<string, number>
  /** Пустые контакты основной карточки, которые заполнятся из дубля */
  fills: string[]
}

/**
 * Объединение дублей: `GET /customers/{id}/merge/?source_id=` — что перейдёт (ничего не меняет),
 * `POST` — объединить. Дубль не удаляется: он уходит в архив с отметкой «объединён с …».
 */
export async function customerMerge(auth: ApiAuth, targetId: string, sourceId: string, confirm: boolean): Promise<MergePlan> {
  const path = `/api/v1/customers/${encodeURIComponent(targetId)}/merge/`
  const plan = confirm
    ? await apiRequest(path, { method: "POST", auth, body: { sourceId }, schema: mergePlanSchema })
    : await apiRequest(path, { auth, query: { sourceId }, schema: mergePlanSchema })
  return { references: plan.references, fills: plan.fills }
}
