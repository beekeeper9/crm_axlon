import { connection } from "next/server"

import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { ChatsSidebar } from "@/features/chats/components/chats-sidebar"
import { chatTimeLabel } from "@/features/chats/lib/chat-list"
import { fetchChannels, fetchWhatsappChats } from "@/features/communications/api/communications-repository"
import { tryLoad } from "@/lib/api/load"
import { apiErrorMessage } from "@/lib/api/errors"
import { getRenderAuth } from "@/lib/auth/token-store"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

/**
 * Панель чатов сбоку от всех разделов. Менеджер видит только чаты; подключать WhatsApp могут
 * директор и РОП. Какие диалоги кому видны и подключён ли канал — решает backend.
 */
export async function ChatsPanel() {
  const user = await getCurrentUser()
  if (!hasPermission(user.role, "chats.view")) return null
  const canConnect = hasPermission(user.role, "chats.connect")
  if (isMockDataSource) {
    return <ChatsSidebar chats={[]} connected={null} canConnect={false} problem="Чаты хранятся на сервере — в демо-режиме их нет." />
  }

  await connection()
  const now = new Date()
  const auth = await getRenderAuth()
  const [chats, channels] = await Promise.all([tryLoad(() => fetchWhatsappChats(auth)), tryLoad(() => fetchChannels(auth))])
  if (!chats.ok) return <ChatsSidebar chats={[]} connected={null} canConnect={false} problem={apiErrorMessage(chats.error)} />

  const whatsapp = channels.ok ? channels.data.find((state) => state.channel === "whatsapp") : undefined
  return (
    <ChatsSidebar
      chats={chats.data.map((chat) => ({ ...chat, timeLabel: chatTimeLabel(chat.lastMessageAt, now) }))}
      connected={whatsapp ? whatsapp.canSend : null}
      canConnect={canConnect}
      problem={null}
    />
  )
}

export function ChatsPanelSkeleton() {
  return (
    <aside aria-busy="true" className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-72 shrink-0 flex-col gap-3 self-start border-r p-3 lg:flex print:hidden">
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-8 w-full" />
    </aside>
  )
}
