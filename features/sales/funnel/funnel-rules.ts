import type { FunnelStage, NewFunnelStage } from "@/features/sales/funnel/funnel-api"

/**
 * Готовый набор этапов, который РОП может взять за основу и потом изменить.
 * Это только шаблон: этапы хранятся на сервере и настраиваются РОПом.
 */
export const FUNNEL_TEMPLATE: readonly NewFunnelStage[] = [
  { name: "Новый лид", kind: "open" },
  { name: "Тёплый", kind: "open" },
  { name: "Думает", kind: "open" },
  { name: "NDZ — не дозвонились", kind: "open" },
  { name: "Повторный контакт", kind: "open" },
  { name: "Встреча назначена", kind: "open" },
  { name: "Успешная сделка", kind: "won" },
  { name: "Отказ", kind: "lost" },
]

export const KIND_LABELS = { open: "В работе", won: "Успех", lost: "Отказ" } as const

/** Рабочие (не архивные) этапы по порядку */
export function activeStages(stages: readonly FunnelStage[]): FunnelStage[] {
  return stages.filter((stage) => stage.isActive).toSorted((a, b) => a.position - b.position)
}

/**
 * Новый порядок всех этапов после сдвига рабочего этапа на одну позицию вверх или вниз.
 * Архивные этапы остаются на своих местах в конце: backend требует полный список.
 */
export function movedOrder(stages: readonly FunnelStage[], stageId: string, direction: -1 | 1): string[] | null {
  const active = activeStages(stages)
  const index = active.findIndex((stage) => stage.id === stageId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= active.length) return null
  const reordered = [...active]
  ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
  const archived = stages.filter((stage) => !stage.isActive).toSorted((a, b) => a.position - b.position)
  return [...reordered, ...archived].map((stage) => stage.id)
}

/** Куда можно перенести сделки удаляемого этапа: другие рабочие этапы того же вида */
export function moveTargets(stages: readonly FunnelStage[], stageId: string): FunnelStage[] {
  const stage = stages.find((item) => item.id === stageId)
  if (!stage) return []
  return activeStages(stages).filter((item) => item.id !== stageId && item.kind === stage.kind)
}

/** Удалять нельзя последний рабочий этап своего вида: сделки должно быть куда вести и чем закрывать */
export function isLastOfKind(stages: readonly FunnelStage[], stageId: string): boolean {
  return moveTargets(stages, stageId).length === 0
}
