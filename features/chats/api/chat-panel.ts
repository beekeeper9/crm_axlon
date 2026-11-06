import { chatTimeLabel, type ChatPanelState } from "@/features/chats/lib/chat-list"
import { fetchChannels, fetchWhatsappChats } from "@/features/communications/api/communications-repository"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiErrorMessage } from "@/lib/api/errors"
import { tryLoad } from "@/lib/api/load"

/** Чаты и состояние канала: и для первой отрисовки, и для опроса из браузера */
export async function loadChatPanel(auth: ApiAuth, now: Date): Promise<ChatPanelState> {
  const [chats, channels] = await Promise.all([tryLoad(() => fetchWhatsappChats(auth)), tryLoad(() => fetchChannels(auth))])
  if (!chats.ok) return { chats: [], connected: null, problem: apiErrorMessage(chats.error) }
  const whatsapp = channels.ok ? channels.data.find((state) => state.channel === "whatsapp") : undefined
  return {
    chats: chats.data.map((chat) => ({ ...chat, timeLabel: chatTimeLabel(chat.lastMessageAt, now) })),
    connected: whatsapp ? whatsapp.canSend : null,
    problem: null,
  }
}
