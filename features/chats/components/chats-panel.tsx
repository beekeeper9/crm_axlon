import { connection } from "next/server"

import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { loadChatPanel } from "@/features/chats/api/chat-panel"
import { ChatsSidebar } from "@/features/chats/components/chats-sidebar"
import { getRenderAuth } from "@/lib/auth/token-store"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

const DEMO_STATE = { chats: [], connected: null, problem: "Чаты хранятся на сервере — в демо-режиме их нет." }

/**
 * Панель чатов сбоку от всех разделов. Менеджер видит только чаты; подключать WhatsApp могут
 * директор и РОП. Какие диалоги кому видны и подключён ли канал — решает backend.
 */
export async function ChatsPanel() {
  const user = await getCurrentUser()
  if (!hasPermission(user.role, "chats.view")) return null
  if (isMockDataSource) return <ChatsSidebar initial={DEMO_STATE} live={false} canConnect={false} canOpenIntegrations={false} />

  await connection()
  return (
    <ChatsSidebar
      initial={await loadChatPanel(await getRenderAuth(), new Date())}
      live
      canConnect={hasPermission(user.role, "chats.connect")}
      canOpenIntegrations={hasPermission(user.role, "company.settings")}
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
