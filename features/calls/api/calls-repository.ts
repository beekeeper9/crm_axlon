import { isMockDataSource } from "@/config/env"
import { callSchema, type Call, type CallDirection } from "@/features/calls/schemas"
import { contractPending } from "@/lib/api/errors"
import { paginate, paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"
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

/** Endpoint не согласованы — см. docs/API_CONTRACT.md, раздел «Звонки». */
const httpCallsRepository: CallsRepository = {
  async listCalls() {
    return contractPending("список звонков")
  },
  async getCall() {
    return contractPending("звонок")
  },
}

export const callsRepository: CallsRepository = isMockDataSource ? mockCallsRepository : httpCallsRepository
