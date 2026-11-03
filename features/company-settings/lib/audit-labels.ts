/**
 * Подписи записей журнала. Backend пишет действие как «ресурс.глагол» (`deal.stage_changed`);
 * неизвестные значения показываем как есть — так новая запись не пропадёт из журнала.
 */

const RESOURCE_LABELS: Record<string, string> = {
  customer: "Клиент",
  lead: "Лид",
  deal: "Сделка",
  activity: "Задача",
  meeting: "Встреча",
  payment: "Оплата",
  invoice: "Счёт",
  plan: "План",
  pipeline: "Воронка",
  department: "Отдел",
  staff: "Сотрудник",
  user: "Сотрудник",
  membership: "Сотрудник",
  company: "Компания",
  organization: "Компания",
  custom_field: "Дополнительное поле",
  loss_reason: "Причина отказа",
  reference_list: "Справочник",
  message_template: "Шаблон сообщения",
  import: "Импорт",
  import_job: "Импорт",
  workspace_layout: "Рабочее пространство",
  risk_settings: "Настройки рисков",
  operations_settings: "Настройки операционного отдела",
  conversation: "Переписка",
  absence: "Отсутствие",
  agent_action: "Действие ИИ-агента",
}

const VERB_LABELS: Record<string, string> = {
  created: "создан(а)",
  updated: "изменён(а)",
  deleted: "удалён(а)",
  archived: "в архиве",
  restored: "восстановлен(а)",
  reassigned: "смена ответственного",
  merged: "объединение дублей",
  merged_into: "объединён(а) с другой записью",
  stage_changed: "смена этапа",
  won: "выиграна",
  lost: "проиграна",
  registered: "зарегистрирована",
  completed: "завершён(а)",
  task_completed: "задача выполнена",
  task_reassigned: "задача передана",
  tasks_handed_over: "задачи переданы",
  deactivated: "отключён",
  password_reset: "сброс пароля",
  request_approved: "заявка одобрена",
  request_rejected: "заявка отклонена",
  assigned: "назначен ответственный",
  closed: "закрыт(а)",
  stage_added: "добавлен этап",
  stage_updated: "изменён этап",
  stage_deleted: "удалён этап",
  stages_reordered: "изменён порядок этапов",
  deals_adopted: "сделки перенесены",
  item_updated: "изменён пункт",
  reordered: "изменён порядок",
  rejected: "отклонено",
}

export function resourceLabel(resourceType: string): string {
  return RESOURCE_LABELS[resourceType] ?? resourceType
}

export function actionLabel(action: string): string {
  const dot = action.indexOf(".")
  if (dot < 0) return action
  const resource = RESOURCE_LABELS[action.slice(0, dot)]
  const verb = VERB_LABELS[action.slice(dot + 1)]
  return resource && verb ? `${resource}: ${verb}` : action
}

/**
 * Разделы для фильтра журнала — префикс действия (`deal.`). Префикс надёжнее типа ресурса:
 * модули backend называют ресурсы по-разному (сотрудник — `membership` или `user`).
 */
export const AUDIT_SECTIONS = ["customer", "lead", "deal", "activity", "meeting", "payment", "plan", "pipeline", "staff", "department", "company"] as const

/** Смена ответственного: backend кладёт в details идентификаторы прежнего и нового владельца */
export function ownerChange(details: Record<string, unknown>): { from: string; to: string } | null {
  const from = details.fromOwner ?? details.from_owner
  const to = details.toOwner ?? details.to_owner
  return typeof from === "string" && typeof to === "string" ? { from, to } : null
}
