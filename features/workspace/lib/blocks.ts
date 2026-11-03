/** Блоки «Моего дня», которые настраивает руководитель. Значения — как в API backend */
export const WORKSPACE_BLOCKS = ["work_session", "counters", "plans", "month_metrics", "focus_deals"] as const

export type WorkspaceBlockId = (typeof WORKSPACE_BLOCKS)[number]

export const BLOCK_LABELS: Record<WorkspaceBlockId, { title: string; description: string }> = {
  work_session: { title: "Рабочая смена", description: "Начало и конец работы" },
  counters: { title: "Дела на сегодня", description: "Задачи на сегодня, просроченные задачи, встречи сегодня" },
  plans: { title: "Мои планы", description: "Личный план и выполнение" },
  month_metrics: { title: "Этот месяц", description: "Продажи, новые клиенты, оборот, получено, долг" },
  focus_deals: { title: "Сделки в приоритете", description: "Первые записи из «Фокуса»" },
}

export type WorkspaceBlock = { id: WorkspaceBlockId; visible: boolean }

/** Порядок и видимость по умолчанию — когда руководитель ничего не настраивал */
export const DEFAULT_LAYOUT: readonly WorkspaceBlock[] = WORKSPACE_BLOCKS.map((id) => ({ id, visible: true }))
