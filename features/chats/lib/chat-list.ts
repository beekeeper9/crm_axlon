import { routes } from "@/config/routes"
import type { Conversation, Message } from "@/features/communications/api/communications-repository"
import { API_ERROR_MESSAGES, apiErrorMessage, type ApiError } from "@/lib/api/errors"
import { formatDayMonth, formatFullDate, formatTime } from "@/lib/format"

/** Строка панели: подпись времени считает сервер — в браузере «сегодня» могло бы разойтись с разметкой */
export type ChatRow = Conversation & { timeLabel: string | null }

export type ChatPanelState = {
  chats: readonly ChatRow[]
  /** `null` — неизвестно: канал не загрузился, кнопку подключения не показываем */
  connected: boolean | null
  problem: string | null
}

export function chatTitle(chat: Conversation): string {
  return chat.contactName || chat.externalContactId
}

/** Сегодняшнее сообщение — время, более раннее — дата */
export function chatTimeLabel(lastMessageAt: string | null, now: Date): string | null {
  if (!lastMessageAt) return null
  const isToday = formatFullDate(lastMessageAt) === formatFullDate(now.toISOString())
  return isToday ? formatTime(lastMessageAt) : formatDayMonth(lastMessageAt)
}

export function filterChats<T extends Conversation>(chats: readonly T[], query: string): readonly T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return chats
  return chats.filter((chat) => chatTitle(chat).toLowerCase().includes(needle))
}

/** Новый чат приходит с лидом; без лида и клиента открыть негде */
export function chatHref(chat: Conversation): string | null {
  if (chat.leadId) return `${routes.leads}/${encodeURIComponent(chat.leadId)}`
  return chat.customerId ? `${routes.clientBase}?client=${encodeURIComponent(chat.customerId)}` : null
}

export type ChatThread = { conversation: Conversation; messages: readonly Message[]; truncated: boolean }

/** Код WhatsApp: окно 24 часов после сообщения клиента закрылось */
const WINDOW_CLOSED_CODE = "131047"

const ERROR_MESSAGES: Record<string, string> = {
  channel_not_configured: "WhatsApp не подключён.",
  channel_delivery_failed: "WhatsApp не принял сообщение. Текст остался в поле, попробуйте ещё раз.",
  conversation_invalid_state: "Чат закрыт. Откройте его снова, чтобы ответить.",
}

export function chatErrorMessage(error: ApiError): string {
  if (error.code && ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code]
  if (error.kind === "forbidden" && error.code !== "feature_not_in_plan") return "Нет прав на этот чат."
  return error.kind === "validation" ? API_ERROR_MESSAGES.validation : apiErrorMessage(error)
}

/** Исходящее без автора написано в приложении на телефоне, а не из CRM */
export function messageAuthor(message: Message): string {
  if (message.direction === "inbound") return "Клиент"
  return message.senderUserId ? "Компания" : "С телефона"
}

/** `sent` значит только, что WhatsApp принял сообщение, поэтому «доставлено» не обещаем */
export function messageProblem(message: Message): string | null {
  if (message.status !== "failed") return null
  if (message.failureCode === WINDOW_CLOSED_CODE) return "Прошло больше 24 часов с сообщения клиента. Обычным сообщением ответить нельзя."
  return "Не доставлено"
}
