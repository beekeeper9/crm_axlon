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
import { ApiError, contractPending } from "@/lib/api/errors"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"
import { paginatedSchema } from "@/lib/api/pagination"
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
  createdAt: z.iso.datetime({ offset: true }),
  customer: z
    .object({ id: z.string(), name: z.string(), email: z.string().nullable(), phone: z.string().nullable() })
    .nullable(),
  owner: z.object({ id: z.string(), name: z.string() }),
})

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
    const [pipeline, stageEnteredAt] = await Promise.all([
      fetchPipeline(auth, deal.pipelineId),
      loadStageEnteredAt(auth, deal.id, deal.createdAt),
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
      related: [],
    })
  },
  async getActivity() {
    return contractPending("история лида")
  },
  async listOptions() {
    return contractPending("поиск лидов")
  },
}

export const leadsRepository: LeadsRepository = isMockDataSource
  ? mockLeadsRepository
  : httpLeadsRepository
