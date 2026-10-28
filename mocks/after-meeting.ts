/**
 * ДЕМО-ДАННЫЕ «После встречи», собранные из демо-встреч и демо-сделок.
 * Группы здесь раскладывает mock-слой; в реальном режиме это делает backend.
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import type { AfterMeetingItem, AfterMeetingQueue, AfterMeetingState } from "@/features/after-meeting/schemas"
import { demoDeals, demoSalesConfig } from "@/mocks/crm"
import { demoMeetings } from "@/mocks/meetings"

const AI_HINTS: Record<string, string> = {
  "lead-f-04": "Решение откладывается: клиентка советуется с мужем. Предложите короткую встречу для обоих.",
  "lead-f-07": "Клиент готов оплатить и ждёт реквизиты — отправьте их сегодня.",
  "lead-f-02": "Юрист клиента ждёт договор. Чем быстрее согласование, тем выше шанс закрыть в этом месяце.",
}

const GROUPS: Record<AfterMeetingState, { title: string; description: string }> = {
  outcome_required: { title: "Записать итог", description: "Встреча прошла, а итог не записан" },
  no_next_step: { title: "Нет следующего шага", description: "Итог есть, но следующий шаг не назначен" },
  awaiting_decision: { title: "Ждём решения клиента", description: "Следующий шаг назначен — держите в поле зрения" },
}

const stageNames = new Map(demoSalesConfig.pipelines.flatMap((pipeline) => pipeline.stages.map((stage) => [stage.id, stage.name])))
const pipelineNames = new Map(demoSalesConfig.pipelines.map((pipeline) => [pipeline.id, pipeline.name]))

function stateFor(meeting: (typeof demoMeetings)[number], hasNextAction: boolean): AfterMeetingState | null {
  if (meeting.outcomeRequired) return "outcome_required"
  if (meeting.status !== "held") return null
  return hasNextAction ? "awaiting_decision" : "no_next_step"
}

export function demoAfterMeetingQueue(hostId: string | null): AfterMeetingQueue {
  // Последняя прошедшая встреча по каждому лиду
  const latest = new Map<string, (typeof demoMeetings)[number]>()
  for (const meeting of demoMeetings.toSorted((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    if (meeting.outcomeRequired || meeting.status === "held") latest.set(meeting.lead.id, meeting)
  }

  const items: AfterMeetingItem[] = []
  for (const meeting of latest.values()) {
    const deal = demoDeals.find((item) => item.id === meeting.lead.id)
    if (!deal || (hostId && meeting.host.id !== hostId)) continue
    const state = stateFor(meeting, deal.nextAction !== null)
    if (!state) continue
    items.push({
      id: meeting.id,
      state,
      meeting: { id: meeting.id, startsAt: meeting.startsAt, format: meeting.format, host: meeting.host, outcomeComment: meeting.outcomeComment },
      lead: { id: deal.id, name: deal.title, phone: deal.client.phone },
      pipelineName: pipelineNames.get(deal.pipelineId) ?? "",
      stageName: stageNames.get(deal.stageId) ?? "",
      amount: deal.amount,
      currency: deal.currency,
      nextAction: deal.nextAction && { title: deal.nextAction.title, dueAt: deal.nextAction.dueAt },
      aiHint: AI_HINTS[deal.id] ?? null,
    })
  }

  return {
    groups: (Object.keys(GROUPS) as AfterMeetingState[]).map((state) => ({
      id: state,
      ...GROUPS[state],
      items: items.filter((item) => item.state === state).toSorted((a, b) => b.meeting.startsAt.localeCompare(a.meeting.startsAt)),
    })),
  }
}
