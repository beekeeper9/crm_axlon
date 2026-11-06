import { routes } from "@/config/routes"
import type { Conversation } from "@/features/communications/api/communications-repository"
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
