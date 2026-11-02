import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { callSchema, type Call, type CallDirection } from "@/features/calls/schemas"
import { loadPeopleNames } from "@/features/team"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { ApiError, contractPending } from "@/lib/api/errors"
import { paginate, paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"
import { demoCalls } from "@/mocks/calls"
import { simulateLatency } from "@/mocks/latency"
import { demoOwnScope, demoScopedManagerId } from "@/mocks/scope"

export type CallsQuery = PageParams & {
  direction: CallDirection | null
  missedOnly: boolean
  managerId: string | null
  leadId: string | null
  search: string | null
}

export type CallsRepository = {
  listCalls(query: CallsQuery): Promise<Paginated<Call>>
  getCall(callId: string): Promise<Call | null>
}

const callsPageSchema = paginatedSchema(callSchema)

/** Демо-слой повторяет правило backend: оценку получает только руководитель */
async function withAccessRules(calls: Call[]): Promise<Call[]> {
  const user = await getCurrentUser()
  const canSeeRating = hasPermission(user.role, "team.view")
  return canSeeRating ? calls : calls.map((call) => ({ ...call, rating: null }))
}

function matches(call: Call, { direction, missedOnly, managerId, leadId, search }: Omit<CallsQuery, keyof PageParams>): boolean {
  if (direction && call.direction !== direction) return false
  if (missedOnly && call.status !== "missed") return false
  if (managerId && call.manager.id !== managerId) return false
  if (leadId && call.lead?.id !== leadId) return false
  if (!search) return true
  const needle = search.toLocaleLowerCase("ru")
  const digits = search.replace(/\D/g, "")
  return (
    (call.lead?.name.toLocaleLowerCase("ru").includes(needle) ?? false) ||
    (digits.length >= 3 && call.phone.replace(/\D/g, "").includes(digits))
  )
}

const mockCallsRepository: CallsRepository = {
  async listCalls({ limit, offset, ...requested }) {
    await simulateLatency(450)
    const query = { ...requested, managerId: await demoScopedManagerId(requested.managerId) }
    const calls = demoCalls.filter((call) => matches(call, query)).toSorted((a, b) => b.at.localeCompare(a.at))
    return callsPageSchema.parse(paginate(await withAccessRules(calls), { limit, offset }))
  },
  async getCall(callId) {
    await simulateLatency(250)
    const [call, ownScope] = [demoCalls.find((item) => item.id === callId), await demoOwnScope()]
    if (!call || (ownScope && call.manager.id !== ownScope)) return null
    const [visible] = await withAccessRules([call])
    return callSchema.parse(visible)
  },
}

/** Звонок из `GET /telephony/calls/`; имена полей уже в camelCase */
const backendCallSchema = z.object({
  id: z.string(),
  direction: z.enum(["inbound", "outbound"]),
  fromNumber: z.string(),
  toNumber: z.string(),
  status: z.enum(["requested", "ringing", "in_progress", "completed", "missed", "failed"]),
  startedAt: z.iso.datetime({ offset: true }).nullable(),
  durationSeconds: z.int().nonnegative(),
  recordingUrl: z.string().nullable(),
  subjectType: z.enum(["customer", "deal"]).nullable(),
  subjectId: z.string().nullable(),
  ownerUserId: z.string(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
})

export type BackendCall = z.infer<typeof backendCallSchema>

const backendCallsPageSchema = paginatedSchema(backendCallSchema)
const titleSchema = z.object({ id: z.string(), title: z.string() })
const nameSchema = z.object({ id: z.string(), name: z.string() })

const STATUS: Record<BackendCall["status"], Call["status"]> = {
  requested: "in_progress",
  ringing: "in_progress",
  in_progress: "in_progress",
  completed: "answered",
  missed: "missed",
  failed: "missed",
}

/**
 * Перевод в интерфейс. Транскрипта, разбора ИИ и оценки в ответе телефонии нет — они null,
 * а не выдуманные значения. Номер клиента — «откуда» для входящего и «куда» для исходящего.
 */
export function toCall(call: BackendCall, nameOf: (userId: string) => string, subjects: ReadonlyMap<string, string>): Call {
  const subjectName = call.subjectId ? subjects.get(call.subjectId) : undefined
  const ref = call.subjectId && subjectName ? { id: call.subjectId, name: subjectName } : null
  return {
    id: call.id,
    at: call.startedAt ?? call.createdAt,
    direction: call.direction === "inbound" ? "incoming" : "outgoing",
    status: STATUS[call.status],
    durationSec: call.durationSeconds,
    phone: call.direction === "inbound" ? call.fromNumber : call.toNumber,
    lead: call.subjectType === "deal" ? ref : null,
    client: call.subjectType === "customer" ? ref : null,
    manager: { id: call.ownerUserId, name: nameOf(call.ownerUserId) },
    hasRecording: Boolean(call.recordingUrl),
    recordingUrl: call.recordingUrl,
    notes: call.notes,
    transcript: null,
    analysis: null,
    rating: null,
  }
}

/** Названия сделок и имена клиентов, к которым привязаны звонки страницы */
async function subjectNames(auth: ApiAuth, calls: readonly BackendCall[]): Promise<Map<string, string>> {
  const unique = new Map(calls.flatMap((call) => (call.subjectId && call.subjectType ? [[call.subjectId, call.subjectType] as const] : [])))
  const loaded = await Promise.all(
    [...unique].map(async ([id, type]) => {
      const item = await (type === "deal"
        ? apiRequest(`/api/v1/sales/deals/${encodeURIComponent(id)}/`, { auth, schema: titleSchema }).then((deal) => deal.title)
        : apiRequest(`/api/v1/customers/${encodeURIComponent(id)}/`, { auth, schema: nameSchema }).then((customer) => customer.name)
      ).catch(() => null)
      return item ? ([id, item] as const) : null
    })
  )
  return new Map(loaded.filter((entry) => entry !== null))
}

/**
 * `GET /telephony/calls/`: видимость (свои, команда, все) решает backend. Фильтры у него —
 * только направление и статус; по сотруднику, сделке и тексту он не фильтрует, поэтому такие
 * запросы не подменяются неотфильтрованным списком. «Пропущенные» — статус missed
 * (несостоявшиеся failed backend отдельным фильтром не объединяет).
 */
const httpCallsRepository: CallsRepository = {
  async listCalls({ direction, missedOnly, managerId, leadId, search, limit, offset }) {
    if (search) return contractPending("поиск по звонкам")
    if (leadId) return contractPending("звонки по сделке")
    if (managerId) return contractPending("звонки сотрудника")
    const auth = await getRenderAuth()
    const [page, nameOf] = await Promise.all([
      apiRequest("/api/v1/telephony/calls/", {
        auth,
        query: {
          direction: direction ? (direction === "incoming" ? "inbound" : "outbound") : undefined,
          status: missedOnly ? "missed" : undefined,
          limit,
          offset,
        },
        schema: backendCallsPageSchema,
      }),
      loadPeopleNames(),
    ])
    const subjects = await subjectNames(auth, page.results)
    return { count: page.count, results: page.results.map((call) => toCall(call, nameOf, subjects)) }
  },
  async getCall(callId) {
    const auth = await getRenderAuth()
    try {
      const [call, nameOf] = await Promise.all([
        apiRequest(`/api/v1/telephony/calls/${encodeURIComponent(callId)}/`, { auth, schema: backendCallSchema }),
        loadPeopleNames(),
      ])
      return toCall(call, nameOf, await subjectNames(auth, [call]))
    } catch (error) {
      if (error instanceof ApiError && error.kind === "not_found") return null
      throw error
    }
  },
}

export type NewCallLog = {
  direction: "inbound" | "outbound"
  fromNumber: string
  toNumber: string
  status: "completed" | "missed" | "failed"
  /** ISO с часовым поясом */
  startedAt: string
  durationSeconds: number
  notes: string | null
}

/** `POST /telephony/calls/` — записать уже состоявшийся звонок (провайдер не нужен) */
export async function logCall(auth: ApiAuth, call: NewCallLog): Promise<void> {
  await apiRequest("/api/v1/telephony/calls/", {
    method: "POST",
    auth,
    body: {
      direction: call.direction,
      fromNumber: call.fromNumber,
      toNumber: call.toNumber,
      status: call.status,
      startedAt: call.startedAt,
      durationSeconds: call.durationSeconds,
      ...(call.notes ? { notes: call.notes } : {}),
    },
    schema: z.unknown(),
  })
}

export const callsRepository: CallsRepository = isMockDataSource ? mockCallsRepository : httpCallsRepository
