import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { prospectRoute } from "@/config/routes"
import { focusListSchema, type FocusGroup, type FocusItem, type FocusList } from "@/features/focus/schemas"
import { fetchPipeline } from "@/features/sales"
import { loadPeopleNames } from "@/features/team"
import { apiRequest } from "@/lib/api/client"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"
import { getRenderAuth } from "@/lib/auth/token-store"
import { filterDemoFocusList } from "@/mocks/focus"
import { simulateLatency } from "@/mocks/latency"
import { demoOwnScope } from "@/mocks/scope"

export type FocusQuery = {
  /** null — все доступные пользователю лиды (для руководителя — вся команда) */
  managerId: string | null
}

export type FocusRepository = {
  getFocusList(query: FocusQuery): Promise<FocusList>
}

const mockFocusRepository: FocusRepository = {
  async getFocusList({ managerId }) {
    await simulateLatency(400)
    const ownScope = await demoOwnScope()
    const list = filterDemoFocusList(ownScope ?? managerId)
    // Список коллег со счётчиками нужен только руководителю
    return focusListSchema.parse(ownScope ? { ...list, managers: [] } : list)
  },
}

const findingSchema = z.object({
  kind: z.enum(["stale_lead", "overdue_task", "deal_without_next_step", "stalled_deal"]),
  recordType: z.enum(["lead", "deal", "task"]),
  recordId: z.string(),
  ownerUserId: z.string(),
  ageDays: z.int().nonnegative(),
  dealId: z.string().nullable(),
})

const findingsReportSchema = z.object({
  thresholds: z.object({ staleLeadDays: z.int(), stalledDealDays: z.int() }),
  findings: z.array(findingSchema),
  truncated: z.boolean(),
})

type Finding = z.infer<typeof findingSchema>
type Thresholds = z.infer<typeof findingsReportSchema>["thresholds"]

const dealSchema = z.object({
  id: z.string(),
  title: z.string(),
  pipelineId: z.string(),
  stageId: z.string(),
  amount: decimalStringSchema,
  currency: currencyCodeSchema,
  nextStep: z.string().nullable(),
})

/** Группы — в порядке срочности; внутри группы порядок backend (самые старые — первыми) */
const GROUPS: { kind: Finding["kind"]; title: string; tone: FocusGroup["tone"]; description: (t: Thresholds) => string }[] = [
  { kind: "overdue_task", title: "Просроченные задачи", tone: "urgent", description: () => "Срок прошёл, задача не выполнена" },
  { kind: "stale_lead", title: "Необработанные лиды", tone: "urgent", description: (t) => `Новые заявки без работы дольше ${t.staleLeadDays} дн.` },
  { kind: "deal_without_next_step", title: "Сделки без следующего шага", tone: "warm", description: () => "Нет ни открытой задачи, ни следующего шага" },
  { kind: "stalled_deal", title: "Сделки без движения", tone: "neutral", description: (t) => `Этап не менялся дольше ${t.stalledDealDays} дн.` },
]

/** Сколько строк группы показываем с названиями (каждая — запрос к backend) */
const GROUP_ROWS = 25

const days = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "день" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "дня" : "дней"}`

/**
 * `GET /operations/findings/`: правила backend (забытые лиды, просроченные задачи, сделки без
 * шага и без движения) по записям в области видимости пользователя. Приоритета и «ждут ответа»
 * backend не отдаёт — они пустые, а не придуманные. Модуль доступен по тарифу (feature_not_in_plan).
 */
const httpFocusRepository: FocusRepository = {
  async getFocusList({ managerId }) {
    const auth = await getRenderAuth()
    const [report, nameOf] = await Promise.all([
      apiRequest("/api/v1/operations/findings/", { auth, schema: findingsReportSchema }),
      loadPeopleNames(),
    ])
    const counts = new Map<string, number>()
    for (const finding of report.findings) counts.set(finding.ownerUserId, (counts.get(finding.ownerUserId) ?? 0) + 1)
    const mine = report.findings.filter((finding) => !managerId || finding.ownerUserId === managerId)
    const shown = GROUPS.map((group) => ({ group, items: mine.filter((finding) => finding.kind === group.kind) }))

    const visible = shown.flatMap(({ items }) => items.slice(0, GROUP_ROWS))
    const dealIds = [...new Set(visible.flatMap((finding) => (finding.dealId ? [finding.dealId] : finding.recordType === "deal" ? [finding.recordId] : [])))]
    const deals = new Map(
      (await Promise.all(dealIds.map((id) => apiRequest(`/api/v1/sales/deals/${encodeURIComponent(id)}/`, { auth, schema: dealSchema }).catch(() => null))))
        .filter((deal) => deal !== null)
        .map((deal) => [deal.id, deal])
    )
    const pipelines = new Map(
      (await Promise.all([...new Set([...deals.values()].map((deal) => deal.pipelineId))].map((id) => fetchPipeline(auth, id).catch(() => null))))
        .filter((pipeline) => pipeline !== null)
        .map((pipeline) => [pipeline.id, pipeline])
    )
    const leadIds = visible.filter((finding) => finding.recordType === "lead").map((finding) => finding.recordId)
    const leads = new Map(
      (await Promise.all(leadIds.map((id) => apiRequest(`/api/v1/leads/${encodeURIComponent(id)}/`, { auth, schema: z.object({ id: z.string(), name: z.string() }) }).catch(() => null))))
        .filter((lead) => lead !== null)
        .map((lead) => [lead.id, lead.name])
    )
    const taskIds = visible.filter((finding) => finding.recordType === "task").map((finding) => finding.recordId)
    const tasks = new Map(
      (await Promise.all(taskIds.map((id) => apiRequest(`/api/v1/activities/${encodeURIComponent(id)}/`, { auth, schema: z.object({ id: z.string(), title: z.string().nullable() }) }).catch(() => null))))
        .filter((task) => task !== null)
        .map((task) => [task.id, task.title])
    )

    function toItem(finding: Finding): FocusItem {
      const deal = deals.get(finding.dealId ?? (finding.recordType === "deal" ? finding.recordId : ""))
      const pipeline = deal ? pipelines.get(deal.pipelineId) : undefined
      const isLead = finding.recordType === "lead"
      const reason =
        finding.kind === "overdue_task"
          ? `задача «${tasks.get(finding.recordId) ?? "без названия"}» просрочена на ${days(finding.ageDays)}`
          : finding.kind === "stale_lead"
            ? `без работы ${days(finding.ageDays)}`
            : finding.kind === "stalled_deal"
              ? `без движения ${days(finding.ageDays)}`
              : `без шага ${days(finding.ageDays)}`
      return {
        id: `${finding.kind}-${finding.recordId}`,
        lead: isLead
          ? { id: finding.recordId, name: leads.get(finding.recordId) ?? "Лид" }
          : { id: deal?.id ?? finding.dealId ?? finding.recordId, name: deal?.title ?? "Сделка" },
        href: isLead ? prospectRoute(finding.recordId) : null,
        pipelineName: pipeline?.name ?? "",
        stageName: pipeline?.stages.find((stage) => stage.id === deal?.stageId)?.name ?? "",
        priority: null,
        reason: { label: reason, since: null },
        lastInteraction: null,
        nextAction: deal?.nextStep ? { title: deal.nextStep, dueAt: null } : null,
        aiRecommendation: null,
        manager: { id: finding.ownerUserId, name: nameOf(finding.ownerUserId) },
        amount: deal?.amount ?? null,
        currency: deal?.currency ?? null,
      }
    }

    return focusListSchema.parse({
      awaitingReply: null,
      truncated: report.truncated,
      managers: [...counts].map(([id, count]) => ({ id, name: nameOf(id), count })),
      groups: shown.map(({ group, items }) => ({
        id: group.kind,
        title: group.title,
        description: items.length > GROUP_ROWS ? `${group.description(report.thresholds)} · показаны ${GROUP_ROWS} самых старых из ${items.length}` : group.description(report.thresholds),
        tone: group.tone,
        items: items.slice(0, GROUP_ROWS).map(toItem),
      })),
    })
  },
}

export const focusRepository: FocusRepository = isMockDataSource
  ? mockFocusRepository
  : httpFocusRepository
