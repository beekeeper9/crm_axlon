import type { StatusTone } from "@/components/shared/status-badge"
import type { ProspectSource, ProspectStatus } from "@/features/prospects/schemas"

export const PROSPECT_STATUS_META: Record<ProspectStatus, { label: string; tone: StatusTone }> = {
  new: { label: "Новый", tone: "info" },
  qualified: { label: "Квалифицирован", tone: "success" },
  unqualified: { label: "Не подходит", tone: "neutral" },
  converted: { label: "Стал клиентом", tone: "success" },
}

export const PROSPECT_SOURCE_LABELS: Record<ProspectSource, string> = {
  website: "Сайт",
  referral: "Рекомендация",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
  phone: "Звонок",
  import: "Импорт",
  other: "Другое",
}

/** События истории лида от backend → понятные подписи */
export const PROSPECT_HISTORY_LABELS: Record<string, string> = {
  "lead.captured": "Лид создан",
  "lead.updated": "Изменены данные",
  "lead.qualified": "Квалифицирован",
  "lead.disqualified": "Отмечен как неподходящий",
  "lead.converted": "Конвертирован в клиента",
  "lead.reassigned": "Сменился ответственный",
  "lead.auto_assigned": "Назначен автоматически",
}

export const PROSPECT_FIELD_LABELS: Record<string, string> = {
  name: "имя",
  email: "e-mail",
  phone: "телефон",
  owner_user_id: "ответственный",
  status: "статус",
}
