"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { NotificationItem } from "@/features/notifications/api/notifications-repository"
import { markNotificationsReadAction } from "@/features/notifications/actions"
import { formatDateTime, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Страница настроек (пункт меню добавляет родительская конфигурация маршрутов) */
const NOTIFICATION_SETTINGS_PATH = "/profile/notifications"

const CATEGORY_LABELS: Record<NotificationItem["category"], string> = {
  meeting: "Встреча",
  deal: "Сделка",
  lead: "Лид",
  payment: "Оплата",
  system: "Система",
  ai: "ИИ",
  task: "Задача",
}

type NotificationsPopoverProps = {
  unread: number
  items: readonly NotificationItem[]
  /** Список не загрузился — колокольчик показывает причину вместо пустоты */
  failure: string | null
}

export function NotificationsPopover({ unread, items, failure }: NotificationsPopoverProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function markRead(id: string | null) {
    startTransition(async () => {
      const message = await markNotificationsReadAction(id)
      setError(message)
      if (!message) router.refresh()
    })
  }

  return (
    <Popover>
      <PopoverTrigger
        className="relative flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        aria-label={unread > 0 ? `Уведомления: ${unread} непрочитанных` : "Уведомления"}
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground tabular-nums">
            {unread > 99 ? "99+" : formatNumber(unread)}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-medium">Уведомления</p>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markRead(null)} disabled={isPending}>
              <CheckCheck data-icon="inline-start" aria-hidden />
              Прочитать все
            </Button>
          )}
        </div>
        {failure ? (
          <p role="alert" className="px-3 py-4 text-sm text-destructive">
            {failure}
          </p>
        ) : items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Уведомлений нет</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((item) => (
              <li key={item.id} className={cn("space-y-0.5 px-3 py-2", !item.isRead && "bg-primary/5")}>
                <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {CATEGORY_LABELS[item.category]} · {formatDateTime(item.createdAt)}
                  </span>
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={() => markRead(item.id)}
                      disabled={isPending}
                      className="rounded text-primary hover:underline disabled:opacity-50"
                    >
                      Отметить прочитанным
                    </button>
                  )}
                </p>
                {item.href ? (
                  <Link href={item.href} className="block text-sm font-medium hover:text-primary hover:underline">
                    {item.title}
                  </Link>
                ) : (
                  <p className="text-sm font-medium">{item.title}</p>
                )}
                {item.body && <p className="text-meta text-muted-foreground">{item.body}</p>}
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="border-t px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="border-t px-3 py-2">
          <Link href={NOTIFICATION_SETTINGS_PATH} className="text-meta text-primary hover:underline">
            Настройки уведомлений
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
