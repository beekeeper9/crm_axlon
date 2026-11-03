import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { paginatedSchema } from "@/lib/api/pagination"

export const CHANNELS = ["whatsapp", "telegram", "instagram", "email"] as const
export const channelSchema = z.enum(CHANNELS)
export type Channel = z.infer<typeof channelSchema>

export const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
  email: "E-mail",
}

export const templateSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  createdBy: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})

export type MessageTemplate = z.infer<typeof templateSchema>

/** Ограничения backend (домен MessageTemplate) */
export const TEMPLATE_TITLE_MAX = 120
export const TEMPLATE_BODY_MAX = 4000

export type TemplateInput = { title: string; body: string }

/** `GET /communications/templates/` — шаблоны компании, видны всем сотрудникам с доступом к перепискам */
export async function fetchTemplates(auth: ApiAuth): Promise<MessageTemplate[]> {
  return (await apiRequest("/api/v1/communications/templates/", { auth, schema: paginatedSchema(templateSchema) })).results
}

/** Создают, меняют и удаляют шаблоны директор и РОП (backend: staff.manage) */
export function createTemplate(auth: ApiAuth, input: TemplateInput): Promise<MessageTemplate> {
  return apiRequest("/api/v1/communications/templates/", { method: "POST", auth, body: input, schema: templateSchema })
}

export function updateTemplate(auth: ApiAuth, id: string, input: TemplateInput): Promise<MessageTemplate> {
  return apiRequest(`/api/v1/communications/templates/${encodeURIComponent(id)}/`, { method: "PATCH", auth, body: input, schema: templateSchema })
}

export async function deleteTemplate(auth: ApiAuth, id: string): Promise<void> {
  await apiRequest(`/api/v1/communications/templates/${encodeURIComponent(id)}/`, { method: "DELETE", auth, schema: z.unknown() })
}

const channelStateSchema = z.object({ channel: channelSchema, canSend: z.boolean(), reason: z.string().nullable() })

export type ChannelState = z.infer<typeof channelStateSchema>

/** `GET /communications/channels/` — можно ли отправлять через канал. Без провайдера — нельзя */
export async function fetchChannels(auth: ApiAuth): Promise<ChannelState[]> {
  return (await apiRequest("/api/v1/communications/channels/", { auth, schema: z.object({ results: z.array(channelStateSchema) }) })).results
}

const conversationSchema = z.object({
  id: z.string(),
  channel: channelSchema,
  contactName: z.string().nullable(),
  status: z.enum(["open", "closed"]),
  customerId: z.string().nullable(),
  ownerUserId: z.string().nullable(),
  unreadCount: z.int(),
  lastMessageAt: z.iso.datetime({ offset: true }).nullable(),
})

export type Conversation = z.infer<typeof conversationSchema>

const messageSchema = z.object({
  id: z.string(),
  direction: z.enum(["inbound", "outbound"]),
  text: z.string(),
  status: z.enum(["received", "pending", "sent", "failed"]),
  senderUserId: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
})

export type Message = z.infer<typeof messageSchema>

/** Сколько переписок клиента и сообщений в каждой показываем в карточке */
const CONVERSATIONS_LIMIT = 10
const MESSAGES_LIMIT = 200

/** `GET /communications/conversations/?customer_id` — переписки клиента в области пользователя */
export async function fetchCustomerConversations(auth: ApiAuth, customerId: string): Promise<{ total: number; items: Conversation[] }> {
  const page = await apiRequest("/api/v1/communications/conversations/", {
    auth,
    query: { customerId, limit: String(CONVERSATIONS_LIMIT) },
    schema: paginatedSchema(conversationSchema),
  })
  return { total: page.count, items: page.results }
}

/** Сообщения переписки, от старых к новым */
export async function fetchMessages(auth: ApiAuth, conversationId: string): Promise<Message[]> {
  const page = await apiRequest(`/api/v1/communications/conversations/${encodeURIComponent(conversationId)}/messages/`, {
    auth,
    query: { limit: String(MESSAGES_LIMIT) },
    schema: z.object({ results: z.array(messageSchema) }),
  })
  return page.results
}
