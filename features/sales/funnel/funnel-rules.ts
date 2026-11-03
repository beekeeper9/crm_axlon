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
  { name: "Отказ", kind: "lost" },
  // Этап успеха — системная «Продажа», всегда последняя: на неё сделку переводит подтверждённая оплата
  { name: "Продажа", kind: "won" },
]

export const KIND_LABELS = { open: "В работе", won: "Успех", lost: "Отказ" } as const

/** Рабочие (не архивные) этапы по порядку */
export function activeStages(stages: readonly FunnelStage[]): FunnelStage[] {
  return stages.filter((stage) => stage.isActive).toSorted((a, b) => a.position - b.position)
}

/** «Продажа» — системный этап, всегда последний: его не двигают и ниже него ничего не ставят */
export function isSaleStage(stage: Pick<FunnelStage, "systemCode">): boolean {
  return stage.systemCode === "sale"
}

/**
 * Новый порядок всех этапов после сдвига рабочего этапа на одну позицию вверх или вниз.
 * Архивные этапы остаются в конце: backend требует полный список, а «Продажа» — всегда последняя.
 */
export function movedOrder(stages: readonly FunnelStage[], stageId: string, direction: -1 | 1): string[] | null {
  const active = activeStages(stages).filter((stage) => !isSaleStage(stage))
  const index = active.findIndex((stage) => stage.id === stageId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= active.length) return null
  const reordered = [...active]
  ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
  const archived = stages.filter((stage) => !stage.isActive && !isSaleStage(stage)).toSorted((a, b) => a.position - b.position)
  const sale = stages.filter(isSaleStage)
  return [...reordered, ...archived, ...sale].map((stage) => stage.id)
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

/** Системный этап не удаляется и не переименовывается (backend ответит system_stage_locked) */
export function isSystemStage(stage: Pick<FunnelStage, "systemCode">): boolean {
  return Boolean(stage.systemCode)
}

/**
 * Предложение, куда перенести сделки каждого этапа общей воронки: этап воронки отдела с тем же
 * названием, иначе этап на той же позиции среди рабочих (или последний рабочий). Это только
 * подстановка в форму — пользователь меняет её и подтверждает перенос сам.
 */
export function suggestStageMap(
  source: readonly { stageId: string; name: string; openDeals: number }[],
  target: readonly FunnelStage[]
): Record<string, string> {
  const open = activeStages(target).filter((stage) => stage.kind === "open")
  if (open.length === 0) return {}
  const byName = new Map(open.map((stage) => [stage.name.trim().toLocaleLowerCase("ru"), stage.id]))
  const map: Record<string, string> = {}
  source.forEach((stage, index) => {
    if (stage.openDeals === 0) return
    map[stage.stageId] = byName.get(stage.name.trim().toLocaleLowerCase("ru")) ?? open[Math.min(index, open.length - 1)].id
  })
  return map
}
