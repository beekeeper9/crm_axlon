"use client"

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { ChevronLeft, MessagesSquare, Search } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { chatHref, chatTitle, filterChats, type ChatRow } from "@/features/chats/lib/chat-list"
import { formatInitials, formatNumber } from "@/lib/format"

const COLLAPSED_KEY = "chats-panel-collapsed"
const PANEL_CLASSES = "sticky top-14 hidden h-[calc(100svh-3.5rem)] shrink-0 self-start border-r lg:flex print:hidden"

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Свёрнутость — удобство на этом устройстве: без хранилища панель просто остаётся развёрнутой */
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1"
  } catch {
    return false
  }
}

function saveCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0")
  } catch {
    return
  }
  listeners.forEach((listener) => listener())
}

type ChatsSidebarProps = {
  chats: readonly ChatRow[]
  /** `null` — неизвестно: канал не загрузился, кнопку подключения не показываем */
  connected: boolean | null
  canConnect: boolean
  problem: string | null
}

export function ChatsSidebar({ chats, connected, canConnect, problem }: ChatsSidebarProps) {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false)
  const [query, setQuery] = useState("")
  const unread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0)
  const offerConnect = canConnect && connected === false

  if (collapsed) {
    return (
      <aside aria-label="Чаты" className={`${PANEL_CLASSES} w-10`}>
        <button
          type="button"
          aria-expanded={false}
          aria-label="Развернуть чаты"
          onClick={() => saveCollapsed(false)}
          className="flex w-full flex-col items-center gap-2 py-3 text-xs font-semibold tracking-widest text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <MessagesSquare className="size-4" aria-hidden />
          <span className="[writing-mode:vertical-rl]">ЧАТЫ</span>
          {unread > 0 && <span className="rounded-full bg-primary px-1 text-[0.625rem] tracking-normal text-primary-foreground">{formatNumber(unread)}</span>}
        </button>
      </aside>
    )
  }

  const visible = filterChats(chats, query)
  return (
    <aside aria-label="Чаты" className={`${PANEL_CLASSES} w-72 flex-col`}>
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <h2 className="text-sm font-semibold">Чаты</h2>
        <Button variant="ghost" size="icon-sm" aria-expanded aria-label="Свернуть чаты" onClick={() => saveCollapsed(true)}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
      </div>
      {problem ? (
        <p className="m-auto max-w-60 px-3 text-center text-sm text-muted-foreground">{problem}</p>
      ) : chats.length === 0 ? (
        <EmptyState
          className="m-auto"
          icon={MessagesSquare}
          title={connected === false ? "WhatsApp не подключён" : "Чатов пока нет"}
          description={emptyDescription(connected, canConnect)}
          action={offerConnect && <ConnectWhatsapp />}
        />
      ) : (
        <>
          <div className="relative px-3 pb-2">
            <Search className="pointer-events-none absolute top-2 left-5 size-4 text-muted-foreground" aria-hidden />
            <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по имени или номеру" aria-label="Поиск чатов" className="pl-8" />
          </div>
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto border-t">
            {visible.map((chat) => (
              <ChatItem key={chat.id} chat={chat} />
            ))}
            {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Ничего не найдено</li>}
          </ul>
          {offerConnect && (
            <div className="border-t p-3 text-center">
              <ConnectWhatsapp />
            </div>
          )}
        </>
      )}
    </aside>
  )
}

function emptyDescription(connected: boolean | null, canConnect: boolean): string {
  if (connected !== false) return "Новые обращения из WhatsApp появятся здесь."
  return canConnect ? "Подключите номер компании — новые обращения будут появляться здесь." : "Подключить его может директор или РОП. Новые обращения появятся здесь."
}

function ChatItem({ chat }: { chat: ChatRow }) {
  const title = chatTitle(chat)
  const href = chatHref(chat)
  const body = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground" aria-hidden>
        {chat.contactName ? formatInitials(chat.contactName) : "#"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          {chat.timeLabel && <span className="shrink-0 text-xs text-muted-foreground">{chat.timeLabel}</span>}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{href ? "WhatsApp" : "WhatsApp · без клиента"}</span>
          {chat.unreadCount > 0 && (
            <span className="shrink-0 rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {formatNumber(chat.unreadCount)}
              <span className="sr-only"> непрочитанных</span>
            </span>
          )}
        </span>
      </span>
    </>
  )
  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-2.5 px-3 py-2.5">{body}</div>
      )}
    </li>
  )
}

/** Контракт подключения ещё не согласован с backend: кнопка честно говорит об этом, а не имитирует успех */
function ConnectWhatsapp() {
  const [pressed, setPressed] = useState(false)
  return (
    <div className="space-y-2">
      <Button onClick={() => setPressed(true)}>Подключить WhatsApp</Button>
      <p role="status" className="text-xs text-muted-foreground">
        {pressed && "Подключение заработает после обновления сервера. Пока WhatsApp не подключён."}
      </p>
    </div>
  )
}
