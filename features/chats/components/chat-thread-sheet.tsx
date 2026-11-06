"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { chatCommandAction, loadChatThreadAction, sendChatMessageAction, type ChatActionResult } from "@/features/chats/actions"
import { chatHref, chatTitle, messageAuthor, messageProblem, type ChatRow, type ChatThread } from "@/features/chats/lib/chat-list"
import { MESSAGE_TEXT_MAX, type Message } from "@/features/communications/api/communications-repository"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Открытый чат опрашиваем чаще списка: здесь ждут ответа клиента */
const REFRESH_MS = 5_000

type ChatThreadSheetProps = {
  chat: ChatRow
  connected: boolean | null
  /** Счётчики и порядок чатов изменились — панель перечитает список */
  onChanged: () => void
  onClose: () => void
}

/** Окно чата: переписка, ответ клиенту, «взять себе», закрытие. Права и статусы решает backend */
export function ChatThreadSheet({ chat, connected, onChanged, onClose }: ChatThreadSheetProps) {
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function reload() {
    const result = await loadChatThreadAction(chat.id)
    if (result.thread) setThread(result.thread)
    setLoadError(result.error)
    return result.thread
  }

  useEffect(() => {
    let active = true
    const load = () =>
      loadChatThreadAction(chat.id).then((result) => {
        if (!active) return
        if (result.thread) setThread(result.thread)
        setLoadError(result.error)
      })
    void load().then(onChanged)
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, REFRESH_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
    // Чат меняется только с новым экземпляром окна (key), а onChanged — новая функция на каждый рендер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id])

  /** Текст ошибки остаётся на экране; поле ввода очищается только после принятой отправки */
  function perform(action: () => Promise<ChatActionResult>, onDone?: () => void) {
    startTransition(async () => {
      const result = await action()
      setActionError(result.error)
      setDenied((current) => current || result.denied)
      if (result.error) return
      onDone?.()
      await reload()
      onChanged()
    })
  }

  const conversation = thread?.conversation
  const isClosed = conversation?.status === "closed"
  const href = chatHref(chat)

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4 pr-12">
          <SheetTitle className="truncate">{chatTitle(chat)}</SheetTitle>
          <SheetDescription>
            WhatsApp · {chat.externalContactId}
            {isClosed && " · закрыт"}
          </SheetDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            {href && (
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href} onClick={onClose} />}>
                {chat.leadId ? "Карточка лида" : "Карточка клиента"}
              </Button>
            )}
            {conversation && conversation.ownerUserId === null && (
              <Button variant="outline" size="sm" disabled={isPending} onClick={() => perform(() => chatCommandAction(chat.id, "assign"))}>
                Взять себе
              </Button>
            )}
            {conversation && !isClosed && (
              <Button variant="outline" size="sm" disabled={isPending} onClick={() => perform(() => chatCommandAction(chat.id, "close"))}>
                Закрыть чат
              </Button>
            )}
          </div>
        </SheetHeader>

        {thread ? (
          <MessageFeed messages={thread.messages} truncated={thread.truncated} />
        ) : loadError ? (
          <p className="m-auto max-w-72 px-4 text-center text-sm text-muted-foreground">{loadError}</p>
        ) : (
          <div className="flex-1 space-y-2 p-4">
            <Skeleton className="h-12 w-2/3 rounded-lg" />
            <Skeleton className="ml-auto h-12 w-2/3 rounded-lg" />
          </div>
        )}

        {thread && loadError && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Не удалось обновить чат: {loadError}</p>}
        {actionError && (
          <p role="alert" className="border-t px-4 py-2 text-sm text-destructive">
            {actionError}
          </p>
        )}

        {conversation && !denied && (
          <div className="border-t p-3">
            {isClosed ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Чат закрыт</span>
                <Button size="sm" disabled={isPending} onClick={() => perform(() => chatCommandAction(chat.id, "reopen"))}>
                  Открыть снова
                </Button>
              </div>
            ) : connected === false ? (
              <p className="text-sm text-muted-foreground">WhatsApp не подключён: ответить из CRM пока нельзя.</p>
            ) : (
              <ReplyForm pending={isPending} onSend={(text, onSent) => perform(() => sendChatMessageAction(chat.id, text), onSent)} />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function MessageFeed({ messages, truncated }: { messages: readonly Message[]; truncated: boolean }) {
  const bottom = useRef<HTMLLIElement>(null)
  const lastId = messages.at(-1)?.id

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" })
  }, [lastId])

  if (messages.length === 0) return <p className="m-auto text-sm text-muted-foreground">Сообщений нет.</p>
  return (
    <ol aria-label="Сообщения" aria-live="polite" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
      {messages.map((message) => {
        const isOutbound = message.direction === "outbound"
        const problem = messageProblem(message)
        return (
          <li key={message.id} className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", isOutbound ? "bg-primary/10" : "bg-muted")}>
              <p className="break-words whitespace-pre-wrap">{message.text}</p>
              <p className="text-meta mt-1 text-muted-foreground">
                {messageAuthor(message)} · {formatDateTime(message.createdAt)}
              </p>
              {problem && <p className="text-meta mt-1 text-destructive">{problem}</p>}
            </div>
          </li>
        )
      })}
      {truncated && <li className="text-center text-xs text-muted-foreground">Чат слишком длинный: самые новые сообщения здесь не показаны.</li>}
      <li ref={bottom} aria-hidden />
    </ol>
  )
}

function ReplyForm({ pending, onSend }: { pending: boolean; onSend: (text: string, onSent: () => void) => void }) {
  const [text, setText] = useState("")
  const canSend = !pending && text.trim().length > 0

  function submit() {
    if (canSend) onSend(text, () => setText(""))
  }

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Textarea
        aria-label="Ответ клиенту"
        rows={2}
        maxLength={MESSAGE_TEXT_MAX}
        placeholder="Сообщение… Shift+Enter — новая строка"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
          event.preventDefault()
          submit()
        }}
      />
      <Button type="submit" size="icon" aria-label="Отправить" disabled={!canSend}>
        <Send className="size-4" aria-hidden />
      </Button>
    </form>
  )
}
