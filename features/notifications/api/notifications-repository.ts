import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { getRenderAuth } from "@/lib/auth/token-store"

/**
 * Уведомления текущего пользователя: `GET /notifications/` (свои, новые сверху, с числом непрочитанных).
 * Статус доставки в Telegram backend в этом ответе не отдаёт — интерфейс его не показывает.
 */

export const notificationCategorySchema = z.enum(["meeting", "deal", "lead", "payment", "system", "ai"])

const backendNotificationSchema = z.object({
  id: z.string(),
  category: notificationCategorySchema,
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
})

const backendInboxSchema = z.object({
  count: z.int().nonnegative(),
  unread: z.int().nonnegative(),
  results: z.array(backendNotificationSchema),
})

/**
 * Тексты событий backend пишет по-английски; известные — переводим, остальное показываем как есть.
 * Сверено с pied-piper/src/modules/notifications/infrastructure/handlers.py.
 */
const TEXTS: Record<string, string> = {
  "Meeting scheduled": "Назначена встреча",
  "A meeting was scheduled.": "Вам назначена встреча.",
  "New deal": "Новая сделка",
  "A deal was created and assigned to you.": "Создана сделка, вы — ответственный.",
  "New lead": "Новый лид",
  "A lead was captured and assigned to you.": "Поступил лид, вы — ответственный.",
  "Check it before acting on it: AI results can be wrong.": "Проверьте перед тем, как действовать: ИИ может ошибаться.",
  "The AI Platform did not return a result. Try again later.": "ИИ-сервис не вернул результат. Попробуйте позже.",
}

const AI_REPORTS: Record<string, string> = {
  "AI operations digest": "Сводка ИИ по операциям",
  "AI KPI explanation": "Пояснение ИИ к KPI",
  "AI risk review": "Обзор рисков от ИИ",
  "AI call summary": "Разбор звонка ИИ",
  "AI reply suggestion": "Черновик ответа от ИИ",
  "AI deal brief": "Сводка ИИ по сделке",
  "AI assistant plan": "План ИИ-помощника",
}

export function translate(text: string): string {
  if (TEXTS[text]) return TEXTS[text]
  const ai = /^(.+) (is ready|failed)$/.exec(text)
  if (ai && AI_REPORTS[ai[1]]) return `${AI_REPORTS[ai[1]]}: ${ai[2] === "is ready" ? "готово" : "ошибка"}`
  return text
}

export type NotificationItem = {
  id: string
  category: z.infer<typeof notificationCategorySchema>
  title: string
  body: string | null
  /** Ссылка внутри приложения; адреса API и внешние ссылки не показываются */
  href: string | null
  isRead: boolean
  createdAt: string
}

export type NotificationsInbox = { unread: number; items: NotificationItem[] }

/** Только пути приложения: backend иногда кладёт в link адрес своего API */
export function appHref(link: string | null): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//") || link.startsWith("/api/")) return null
  return link
}

export function toInbox(inbox: z.infer<typeof backendInboxSchema>): NotificationsInbox {
  return {
    unread: inbox.unread,
    items: inbox.results.map((item) => ({
      id: item.id,
      category: item.category,
      title: translate(item.title),
      body: item.body ? translate(item.body) : null,
      href: appHref(item.link),
      isRead: item.read,
      createdAt: item.createdAt,
    })),
  }
}

/** Последние уведомления для колокольчика */
export async function fetchInbox(limit: number): Promise<NotificationsInbox> {
  const inbox = await apiRequest("/api/v1/notifications/", { auth: await getRenderAuth(), query: { limit }, schema: backendInboxSchema })
  return toInbox(inbox)
}

/** `POST /notifications/{id}/read/` или `POST /notifications/read-all/` */
export async function markRead(auth: ApiAuth, notificationId: string | null): Promise<void> {
  const path = notificationId ? `/api/v1/notifications/${encodeURIComponent(notificationId)}/read/` : "/api/v1/notifications/read-all/"
  await apiRequest(path, { method: "POST", auth, schema: z.unknown() })
}
