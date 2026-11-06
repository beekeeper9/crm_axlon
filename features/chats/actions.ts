"use server"

import { loadChatPanel } from "@/features/chats/api/chat-panel"
import type { ChatPanelState } from "@/features/chats/lib/chat-list"
import { getActionAuth } from "@/lib/auth/token-store"

export async function refreshChatsAction(): Promise<ChatPanelState> {
  return loadChatPanel(await getActionAuth(), new Date())
}
