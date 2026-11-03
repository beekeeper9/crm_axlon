/** Страница справочников компании (маршрут в навигацию добавляет основная ветка) */
export const REFERENCE_LISTS_ROUTE = "/settings/reference-lists"

/** Справочники: причины отказа живут в модуле продаж, остальные — в `/reference-lists/` */
export const REFERENCE_LISTS = ["loss_reason", "meeting_cancel", "meeting_no_show", "lead_source"] as const
export type ReferenceListKey = (typeof REFERENCE_LISTS)[number]

export const REFERENCE_LIST_META: Record<ReferenceListKey, { title: string; description: string; canAdd: boolean; canReorder: boolean }> = {
  loss_reason: {
    title: "Причины отказа по сделке",
    description: "Выбираются при переводе сделки в «Отказ». Отключённая причина остаётся в старых сделках и в аналитике «Потери».",
    canAdd: true,
    canReorder: false,
  },
  meeting_cancel: {
    title: "Причины отмены встречи",
    description: "Предлагаются при отмене встречи; можно написать и свою причину.",
    canAdd: true,
    canReorder: true,
  },
  meeting_no_show: {
    title: "Причины неявки",
    description: "Предлагаются, когда клиент не пришёл на встречу; можно написать и свою.",
    canAdd: true,
    canReorder: true,
  },
  lead_source: {
    title: "Источники лидов",
    description: "Набор источников задан системой: их можно переименовать и скрыть из форм. Уже записанные лиды сохраняют свой источник.",
    canAdd: false,
    canReorder: false,
  },
}

/** Элемент справочника в одном виде для всех списков; `ref` — то, что backend ждёт в адресе */
export type ReferenceItem = { ref: string; label: string; isActive: boolean }

/** Новый порядок после сдвига элемента на одну позицию; null — сдвигать некуда */
export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] | null {
  const target = index + direction
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return null
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
