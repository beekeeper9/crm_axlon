import type { StatusTone } from "@/components/shared/status-badge"
import type { AccessState, ErrorStatus, Feature, PlanCode, SubscriptionStatus, TicketKind, TicketStatus } from "@/features/platform/schemas"

/** Названия тарифов в интерфейсе; коды и цены — из каталога backend */
export const PLAN_LABELS: Record<PlanCode, string> = {
  trial: "Пробный 7 дней",
  free: "Standard",
  pro: "Pro",
  enterprise: "Premium",
}

/** Платные модули. Основа CRM (клиенты, сделки, задачи, встречи, сотрудники, планы) есть в любом тарифе */
export const FEATURE_LABELS: Record<Feature, string> = {
  telephony: "Телефония",
  communications: "Мессенджеры и почта",
  payments: "Оплаты",
  analytics: "Аналитика и отчёты",
  ai: "ИИ-помощник",
  operations: "Операционный отдел",
  risk: "Контроль рисков",
}

export const ACCESS_META: Record<AccessState, { label: string; tone: StatusTone }> = {
  active: { label: "Действует", tone: "success" },
  expiring: { label: "Скоро закончится", tone: "warning" },
  expired: { label: "Истекла", tone: "danger" },
  past_due: { label: "Просрочена оплата", tone: "warning" },
  cancelled: { label: "Отменена", tone: "neutral" },
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Действует",
  past_due: "Просрочена оплата",
  cancelled: "Отменена",
}

export const ERROR_STATUS_META: Record<ErrorStatus, { label: string; tone: StatusTone }> = {
  new: { label: "Новая", tone: "danger" },
  acknowledged: { label: "В работе", tone: "warning" },
  resolved: { label: "Решена", tone: "success" },
}

export const TICKET_STATUS_META: Record<TicketStatus, { label: string; tone: StatusTone }> = {
  new: { label: "Новое", tone: "info" },
  in_progress: { label: "В работе", tone: "warning" },
  resolved: { label: "Решено", tone: "success" },
  closed: { label: "Закрыто", tone: "neutral" },
}

export const TICKET_KIND_LABELS: Record<TicketKind, string> = {
  question: "Вопрос",
  problem: "Проблема",
  feedback: "Отзыв",
  idea: "Предложение",
}

/** Записи журнала изменений компании (audit backend) */
export const HISTORY_LABELS: Record<string, string> = {
  "platform.company_created": "Компания подключена",
  "platform.subscription_assigned": "Назначены тариф, срок и модули",
  "platform.company_suspended": "Доступ компании приостановлен",
  "platform.company_resumed": "Доступ компании возобновлён",
  "platform.company_updated": "Изменены сведения о компании",
}
