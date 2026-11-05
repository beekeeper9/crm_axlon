import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { fetchPipeline } from "@/features/sales"
import {
  leadActivitySchema,
  leadDetailSchema,
  leadOptionSchema,
  type LeadActivity,
  type LeadDetail,
  type LeadOption,
} from "@/features/leads/schemas"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { ownerChangeSchema, ownerChangeText } from "@/lib/api/owner-change"
import { ApiError } from "@/lib/api/errors"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"
import { PAGE_LIMIT_MAX, paginatedSchema } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { demoDeals } from "@/mocks/crm"
import { simulateLatency } from "@/mocks/latency"
import { demoOwnScope } from "@/mocks/scope"
import { demoLeadActivity, demoLeadDetail } from "@/mocks/lead-details"

export type LeadsRepository = {
  /** null — лид не найден или недоступен пользователю */
  getLead(leadId: string): Promise<LeadDetail | null>
  /** Лента событий по лиду, новые сверху */
  getActivity(leadId: string): Promise<LeadActivity[]>
  /** Короткий список лидов для выбора в формах (поиск по имени — на backend) */
  listOptions(): Promise<LeadOption[]>
}

const mockLeadsRepository: LeadsRepository = {
  async getLead(leadId) {
    await simulateLatency(300)
    const [lead, ownScope] = [demoLeadDetail(leadId), await demoOwnScope()]
    // Чужой лид для менеджера — как 404 от backend: данных нет вовсе
    if (!lead || (ownScope && lead.manager.id !== ownScope)) return null
    return leadDetailSchema.parse(lead)
  },

  async getActivity(leadId) {
    await simulateLatency(500)
    return leadActivitySchema.array().parse(demoLeadActivity(leadId))
  },

  async listOptions() {
    await simulateLatency(150)
    const ownScope = await demoOwnScope()
    const deals = demoDeals.filter((deal) => !ownScope || deal.manager.id === ownScope)
    return leadOptionSchema.array().parse(deals.map((deal) => ({ id: deal.id, name: deal.title })))
  },
}

/** `GET /sales/deals/{id}/` (P0): клиент — только видимый пользователю, ответственный — с именем */
const backendDealDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  amount: decimalStringSchema,
  currency: currencyCodeSchema,
  pipelineId: z.string(),
  stageId: z.string(),
  source: z.string().nullable(),
  nextStep: z.string().nullable(),
  status: z.enum(["open", "won", "lost"]),
  version: z.int(),
  expectedCloseDate: z.iso.date().nullable(),
  closedAt: z.iso.datetime({ offset: true }).nullable(),
  lostReason: z.string().nullable(),
  productId: z.string().nullable().default(null),
  createdAt: z.iso.datetime({ offset: true }),
  customer: z
    .object({ id: z.string(), name: z.string(), email: z.string().nullable(), phone: z.string().nullable() })
    .nullable(),
  owner: z.object({ id: z.string(), name: z.string() }),
})

const backendHistorySchema = z.object({
  results: z.array(
    z.object({
      action: z.string(),
      occurredAt: z.iso.datetime({ offset: true }),
      actor: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
      changedFields: z.array(z.string()),
      details: ownerChangeSchema,
    })
  ),
})

const HISTORY_TITLES: Record<string, string> = {
  "deal.created": "Сделка создана",
  "deal.updated": "Сделка изменена",
  "deal.stage_changed": "Смена этапа",
  "deal.won": "Сделка выиграна",
  "deal.lost": "Сделка проиграна",
  "deal.reopened": "Сделка открыта снова",
  "deal.reassigned": "Передана другому сотруднику",
}

const FIELD_LABELS: Record<string, string> = {
  title: "название",
  amount: "сумма",
  currency: "валюта",
  stage_id: "этап",
  owner_user_id: "ответственный",
  next_step: "следующий шаг",
  expected_close_date: "ожидаемая дата закрытия",
  customer_id: "клиент",
  source: "источник",
  custom_fields: "дополнительные поля",
  status: "статус",
}

/** Другие сделки того же клиента: каждая — отдельная продажа, у каждой свой этап */
async function loadRelatedDeals(auth: ApiAuth, customerId: string, dealId: string) {
  const page = await apiRequest("/api/v1/sales/deals/", {
    auth,
    query: { customerId, ordering: "-created_at", limit: 20 },
    schema: paginatedSchema(z.object({ id: z.string(), title: z.string(), pipelineId: z.string(), stageId: z.string() })),
  })
  const others = page.results.filter((deal) => deal.id !== dealId)
  const pipelines = await Promise.all([...new Set(others.map((deal) => deal.pipelineId))].map((id) => fetchPipeline(auth, id)))
  const byId = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline]))
  return others.map((deal) => {
    const pipeline = byId.get(deal.pipelineId)
    return {
      id: deal.id,
      title: deal.title,
      pipelineName: pipeline?.name ?? "",
      stageName: pipeline?.stages.find((stage) => stage.id === deal.stageId)?.name ?? "",
    }
  })
}

/** История смен этапа идёт от старых к новым */
const backendStageHistorySchema = paginatedSchema(z.object({ createdAt: z.iso.datetime({ offset: true }) }))

/** Когда сделка попала на текущий этап: последняя смена этапа, а без смен — создание сделки */
async function loadStageEnteredAt(auth: ApiAuth, dealId: string, createdAt: string): Promise<string> {
  const path = `/api/v1/sales/deals/${encodeURIComponent(dealId)}/stage-history/`
  const first = await apiRequest(path, { auth, query: { limit: 1 }, schema: backendStageHistorySchema })
  if (first.count === 0) return createdAt
  const last =
    first.count === 1
      ? first
      : await apiRequest(path, { auth, query: { limit: 1, offset: first.count - 1 }, schema: backendStageHistorySchema })
  return last.results[0]?.createdAt ?? createdAt
}

/**
 * Карточка в режиме api: данные сделки, её воронка и дата входа на этап.
 * Чего backend не отдаёт (город клиента, метки, сводка ИИ, оплаты, свои поля, другие сделки
 * клиента), остаётся пустым, а не придумывается — см. docs/API_CONTRACT.md.
 */
const httpLeadsRepository: LeadsRepository = {
  async getLead(leadId) {
    const auth = await getRenderAuth()
    let deal: z.infer<typeof backendDealDetailSchema>
    try {
      deal = await apiRequest(`/api/v1/sales/deals/${encodeURIComponent(leadId)}/`, {
        auth,
        schema: backendDealDetailSchema,
      })
    } catch (error) {
      // Чужая и несуществующая сделка для backend неразличимы — обе 404
      if (error instanceof ApiError && error.kind === "not_found") return null
      throw error
    }
    const [pipeline, stageEnteredAt, related] = await Promise.all([
      fetchPipeline(auth, deal.pipelineId),
      loadStageEnteredAt(auth, deal.id, deal.createdAt),
      deal.customer ? loadRelatedDeals(auth, deal.customer.id, deal.id) : Promise.resolve([]),
    ])
    const customer = deal.customer
    return leadDetailSchema.parse({
      id: deal.id,
      title: deal.title,
      client: customer
        ? { name: customer.name, phones: customer.phone ? [customer.phone] : [], email: customer.email, city: null }
        : null,
      pipeline,
      stageId: deal.stageId,
      manager: { id: deal.owner.id, name: deal.owner.name || "Сотрудник" },
      amount: deal.amount,
      currency: deal.currency,
      source: deal.source,
      createdAt: deal.createdAt,
      stageEnteredAt,
      tags: [],
      nextAction: deal.nextStep ? { title: deal.nextStep, dueAt: null, isOverdue: false } : null,
      aiContext: null,
      payment: null,
      customFields: [],
      related,
      status: deal.status,
      version: deal.version,
      customerId: deal.customer?.id ?? null,
      nextStep: deal.nextStep,
      expectedCloseDate: deal.expectedCloseDate,
      closedAt: deal.closedAt,
      lostReason: deal.lostReason,
      productId: deal.productId,
    })
  },
  /** `GET /sales/deals/{id}/history/` — журнал изменений (какие поля, кто и когда, без значений) */
  async getActivity(leadId) {
    const history = await apiRequest(`/api/v1/sales/deals/${encodeURIComponent(leadId)}/history/`, {
      auth: await getRenderAuth(),
      schema: backendHistorySchema,
    })
    return history.results.map((entry, index) =>
      leadActivitySchema.parse({
        id: `${entry.occurredAt}-${index}`,
        at: entry.occurredAt,
        kind: entry.action === "deal.stage_changed" || entry.action === "deal.won" || entry.action === "deal.lost" ? "stage" : "note",
        title: HISTORY_TITLES[entry.action] ?? entry.action,
        // Передача сделки называет прежнего и нового ответственного
        body:
          (entry.action === "deal.reassigned" ? ownerChangeText(entry.details) : null) ??
          (entry.changedFields.length > 0 ? `Изменено: ${entry.changedFields.map((field) => FIELD_LABELS[field] ?? field).join(", ")}` : null),
        author: entry.actor?.name ?? null,
      })
    )
  },
  /** Открытые сделки для выбора (например, в форме встречи): последние PAGE_LIMIT_MAX видимых пользователю */
  async listOptions() {
    const page = await apiRequest("/api/v1/sales/deals/", {
      auth: await getRenderAuth(),
      query: { status: "open", ordering: "-created_at", limit: PAGE_LIMIT_MAX },
      schema: paginatedSchema(z.object({ id: z.string(), title: z.string() })),
    })
    return page.results.map((deal) => ({ id: deal.id, name: deal.title }))
  },
}

export const leadsRepository: LeadsRepository = isMockDataSource
  ? mockLeadsRepository
  : httpLeadsRepository
