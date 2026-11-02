import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { demoProspects } from "@/features/prospects/api/demo-prospects"
import {
  prospectDuplicateSchema,
  prospectSourceSchema,
  prospectStatusSchema,
  type Prospect,
  type ProspectDuplicate,
  type ProspectHistoryEntry,
  type ProspectSource,
  type ProspectStatus,
} from "@/features/prospects/schemas"
import { loadPeopleNames } from "@/features/team"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { paginate, paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { simulateLatency } from "@/mocks/latency"

export type ProspectsQuery = PageParams & {
  search: string | null
  status: ProspectStatus | null
  source: ProspectSource | null
  /** Ответственный; для менеджера backend и так отдаёт только своих */
  ownerId: string | null
}

export type ProspectsRepository = {
  listProspects(query: ProspectsQuery): Promise<Paginated<Prospect>>
  /** null — лид не найден или не виден пользователю */
  getProspect(prospectId: string): Promise<Prospect | null>
  getHistory(prospectId: string): Promise<ProspectHistoryEntry[]>
  getDuplicates(prospectId: string): Promise<ProspectDuplicate[]>
}

const mockProspectsRepository: ProspectsRepository = {
  async listProspects({ search, status, source, limit, offset }) {
    await simulateLatency(300)
    const needle = search?.toLocaleLowerCase("ru") ?? null
    const items = demoProspects.filter(
      (item) =>
        (!status || item.status === status) &&
        (!source || item.source === source) &&
        (!needle || [item.name, item.phone ?? "", item.email ?? ""].some((value) => value.toLocaleLowerCase("ru").includes(needle)))
    )
    return paginate(items, { limit, offset })
  },
  async getProspect(prospectId) {
    await simulateLatency(200)
    return demoProspects.find((item) => item.id === prospectId) ?? null
  },
  async getHistory() {
    return []
  },
  async getDuplicates() {
    return []
  },
}

/** Лид из `GET /leads/`; имена полей уже в camelCase */
export const backendLeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  source: prospectSourceSchema,
  status: prospectStatusSchema,
  ownerUserId: z.string(),
  disqualifyReason: z.string().nullable(),
  convertedCustomerId: z.string().nullable(),
  version: z.int().positive(),
  createdAt: z.iso.datetime({ offset: true }),
})

type BackendLead = z.infer<typeof backendLeadSchema>

const backendHistorySchema = z.object({
  count: z.int().nonnegative(),
  results: z.array(
    z.object({
      action: z.string(),
      occurredAt: z.iso.datetime({ offset: true }),
      actorUserId: z.string().nullable(),
      changedFields: z.array(z.string()),
    })
  ),
})

export function toProspect(lead: BackendLead, nameOf: (userId: string) => string): Prospect {
  const { ownerUserId, ...rest } = lead
  return { ...rest, owner: { id: ownerUserId, name: nameOf(ownerUserId) } }
}

const leadPath = (prospectId: string, action = "") => `/api/v1/leads/${encodeURIComponent(prospectId)}/${action}`

const httpProspectsRepository: ProspectsRepository = {
  async listProspects({ search, status, source, ownerId, limit, offset }) {
    const [page, nameOf] = await Promise.all([
      apiRequest("/api/v1/leads/", {
        auth: await getRenderAuth(),
        query: {
          search: search ?? undefined,
          status: status ?? undefined,
          source: source ?? undefined,
          ownerId: ownerId ?? undefined,
          ordering: "-created_at",
          limit,
          offset,
        },
        schema: paginatedSchema(backendLeadSchema),
      }),
      loadPeopleNames(),
    ])
    return { count: page.count, results: page.results.map((lead) => toProspect(lead, nameOf)) }
  },

  async getProspect(prospectId) {
    try {
      const [lead, nameOf] = await Promise.all([
        apiRequest(leadPath(prospectId), { auth: await getRenderAuth(), schema: backendLeadSchema }),
        loadPeopleNames(),
      ])
      return toProspect(lead, nameOf)
    } catch (error) {
      if (error instanceof ApiError && error.kind === "not_found") return null
      throw error
    }
  },

  async getHistory(prospectId) {
    const [history, nameOf] = await Promise.all([
      apiRequest(leadPath(prospectId, "history/"), { auth: await getRenderAuth(), schema: backendHistorySchema }),
      loadPeopleNames(),
    ])
    return history.results.map(({ actorUserId, ...entry }) => ({
      ...entry,
      actor: actorUserId ? { id: actorUserId, name: nameOf(actorUserId) } : null,
    }))
  },

  async getDuplicates(prospectId) {
    const page = await apiRequest(leadPath(prospectId, "duplicates/"), {
      auth: await getRenderAuth(),
      schema: z.object({ count: z.int().nonnegative(), results: z.array(prospectDuplicateSchema) }),
    })
    return page.results
  },
}

export const prospectsRepository: ProspectsRepository = isMockDataSource ? mockProspectsRepository : httpProspectsRepository

/* Операции — только через server actions (`features/prospects/actions.ts`) */

export type NewProspect = { name: string; phone: string | null; email: string | null; source: ProspectSource }

/** `POST /leads/` — ответственным становится создавший */
export async function createLead(auth: ApiAuth, input: NewProspect): Promise<string> {
  const created = await apiRequest("/api/v1/leads/", {
    method: "POST",
    auth,
    body: { name: input.name, source: input.source, ...(input.phone ? { phone: input.phone } : {}), ...(input.email ? { email: input.email } : {}) },
    schema: z.object({ id: z.string() }),
  })
  return created.id
}

/** `PATCH /leads/{id}/` с версией: 409, если лид успели изменить. Пустой контакт не отправляется — backend его не стирает */
export async function updateLead(
  auth: ApiAuth,
  prospectId: string,
  changes: { name: string; phone: string | null; email: string | null; version: number }
): Promise<void> {
  await apiRequest(leadPath(prospectId), {
    method: "PATCH",
    auth,
    body: {
      name: changes.name,
      version: changes.version,
      ...(changes.phone ? { phone: changes.phone } : {}),
      ...(changes.email ? { email: changes.email } : {}),
    },
    schema: z.unknown(),
  })
}

export async function assignLead(auth: ApiAuth, prospectId: string, ownerUserId: string): Promise<void> {
  await apiRequest(leadPath(prospectId, "assign/"), { method: "POST", auth, body: { ownerUserId }, schema: z.unknown() })
}

export async function qualifyLead(auth: ApiAuth, prospectId: string): Promise<void> {
  await apiRequest(leadPath(prospectId, "qualify/"), { method: "POST", auth, schema: z.unknown() })
}

export async function disqualifyLead(auth: ApiAuth, prospectId: string, reason: string): Promise<void> {
  await apiRequest(leadPath(prospectId, "disqualify/"), { method: "POST", auth, body: { reason }, schema: z.unknown() })
}

export type ProspectConversion = {
  /** Привязать к существующему клиенту (подтверждённый дубль) вместо создания нового */
  customerId: string | null
  /** Сразу открыть сделку */
  deal: { title: string; amount: string } | null
}

const conversionResultSchema = z.object({
  customerId: z.string(),
  alreadyConverted: z.boolean(),
  dealId: z.string().nullable(),
})

export type ConversionResult = z.infer<typeof conversionResultSchema>

/** Тело `POST /leads/{id}/convert/` (имена полей переводит в snake_case транспорт) */
export function conversionBody({ customerId, deal }: ProspectConversion): Record<string, unknown> {
  return {
    ...(customerId ? { customerId } : {}),
    ...(deal ? { createDeal: { title: deal.title, amount: deal.amount } } : {}),
  }
}

/** Идемпотентно: повторная конвертация возвращает того же клиента и не открывает вторую сделку */
export async function convertLead(auth: ApiAuth, prospectId: string, conversion: ProspectConversion): Promise<ConversionResult> {
  return apiRequest(leadPath(prospectId, "convert/"), {
    method: "POST",
    auth,
    body: conversionBody(conversion),
    schema: conversionResultSchema,
  })
}
