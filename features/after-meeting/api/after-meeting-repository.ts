import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import {
  afterMeetingQueueSchema,
  type AfterMeetingItem,
  type AfterMeetingQueue,
  type AfterMeetingState,
} from "@/features/after-meeting/schemas"
import { companyDay, fetchAllMeetings, type BackendMeeting } from "@/features/meetings/api/meetings-repository"
import { fetchPipeline } from "@/features/sales"
import { loadPeopleNames } from "@/features/team"
import { apiRequest } from "@/lib/api/client"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"
import { getRenderAuth } from "@/lib/auth/token-store"
import { demoAfterMeetingQueue } from "@/mocks/after-meeting"
import { simulateLatency } from "@/mocks/latency"
import { demoScopedManagerId } from "@/mocks/scope"

export type AfterMeetingRepository = {
  /** hostId — для руководителя; менеджеру backend сам ограничивает своими встречами */
  getQueue(query: { hostId: string | null }): Promise<AfterMeetingQueue>
}

const mockAfterMeetingRepository: AfterMeetingRepository = {
  async getQueue({ hostId }) {
    await simulateLatency(400)
    return afterMeetingQueueSchema.parse(demoAfterMeetingQueue(await demoScopedManagerId(hostId)))
  },
}

/** За сколько дней назад смотрим состоявшиеся встречи */
const LOOKBACK_DAYS = 14

const dealSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["open", "won", "lost"]),
  pipelineId: z.string(),
  stageId: z.string(),
  amount: decimalStringSchema,
  currency: currencyCodeSchema,
  nextStep: z.string().nullable(),
  customer: z.object({ phone: z.string().nullable() }).nullable(),
})

const GROUPS: { id: AfterMeetingState; title: string; description: string }[] = [
  { id: "outcome_required", title: "Нужен итог", description: "Встреча прошла, а итог не записан" },
  { id: "no_next_step", title: "Нет следующего шага", description: `Встреча состоялась за последние ${LOOKBACK_DAYS} дней, сделка открыта, следующий шаг не указан` },
  { id: "awaiting_decision", title: "Ждём решения", description: `Встреча состоялась, сделка открыта, следующий шаг указан — дожать` },
]

/**
 * Очереди у backend нет: она собирается из его данных по явным правилам (описания групп).
 * Встречи загружаются полностью (все страницы), состояния сделок — из `/sales/deals/{id}/`;
 * по каждой сделке — одна последняя встреча. Подсказок ИИ нет (aiHint пустой).
 */
const httpAfterMeetingRepository: AfterMeetingRepository = {
  async getQueue({ hostId }) {
    const auth = await getRenderAuth()
    const owner = hostId ?? undefined
    const [pending, held, nameOf] = await Promise.all([
      fetchAllMeetings(auth, { outcomeRequired: "true", ownerId: owner, subjectType: "deal" }),
      fetchAllMeetings(auth, { status: "held", ownerId: owner, subjectType: "deal", dateFrom: companyDay(-LOOKBACK_DAYS), dateTo: companyDay(0) }),
      loadPeopleNames(),
    ])
    const latestByDeal = new Map<string, { meeting: BackendMeeting; state: AfterMeetingState }>()
    for (const meeting of held.toSorted((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))) {
      if (meeting.subjectId) latestByDeal.set(meeting.subjectId, { meeting, state: "awaiting_decision" })
    }
    // Встреча без итога важнее состоявшейся: перекрывает её по той же сделке
    for (const meeting of pending) {
      if (meeting.subjectId) latestByDeal.set(meeting.subjectId, { meeting, state: "outcome_required" })
    }

    const deals = new Map(
      (await Promise.all([...latestByDeal.keys()].map((id) => apiRequest(`/api/v1/sales/deals/${encodeURIComponent(id)}/`, { auth, schema: dealSchema }).catch(() => null))))
        .filter((deal) => deal !== null)
        .map((deal) => [deal.id, deal])
    )
    const pipelines = new Map(
      (await Promise.all([...new Set([...deals.values()].map((deal) => deal.pipelineId))].map((id) => fetchPipeline(auth, id).catch(() => null))))
        .filter((pipeline) => pipeline !== null)
        .map((pipeline) => [pipeline.id, pipeline])
    )

    const items: AfterMeetingItem[] = []
    for (const [dealId, { meeting, state }] of latestByDeal) {
      const deal = deals.get(dealId)
      if (!deal || (state !== "outcome_required" && deal.status !== "open")) continue
      const pipeline = pipelines.get(deal.pipelineId)
      const host = meeting.hostUserId ?? meeting.ownerUserId
      items.push({
        id: meeting.id,
        state: state === "awaiting_decision" && !deal.nextStep ? "no_next_step" : state,
        meeting: { id: meeting.id, startsAt: meeting.scheduledStart, format: meeting.format, host: { id: host, name: nameOf(host) }, outcomeComment: meeting.outcome },
        lead: { id: deal.id, name: deal.title, phone: deal.customer?.phone ?? null },
        pipelineName: pipeline?.name ?? "",
        stageName: pipeline?.stages.find((stage) => stage.id === deal.stageId)?.name ?? "",
        amount: deal.amount,
        currency: deal.currency,
        nextAction: deal.nextStep ? { title: deal.nextStep, dueAt: null } : null,
        aiHint: null,
      })
    }
    return afterMeetingQueueSchema.parse({
      groups: GROUPS.map((group) => ({ ...group, items: items.filter((item) => item.state === group.id) })),
    })
  },
}

export const afterMeetingRepository: AfterMeetingRepository = isMockDataSource
  ? mockAfterMeetingRepository
  : httpAfterMeetingRepository
