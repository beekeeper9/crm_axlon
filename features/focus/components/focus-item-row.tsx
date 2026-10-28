import Link from "next/link"
import {
  AlarmClock,
  ArrowRight,
  MessageSquare,
  NotebookPen,
  Phone,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { leadRoute } from "@/config/routes"
import type { FocusItem, FocusPriority } from "@/features/focus/schemas"
import { formatDayMonth, formatTime } from "@/lib/format"

const PRIORITY_META: Record<FocusPriority, { label: string; barClass: string }> = {
  high: { label: "Высокий приоритет", barClass: "bg-destructive" },
  medium: { label: "Средний приоритет", barClass: "bg-warning" },
  low: { label: "Низкий приоритет", barClass: "bg-muted-foreground/40" },
}

const CHANNEL_ICONS: Record<NonNullable<FocusItem["lastInteraction"]>["channel"], LucideIcon> = {
  call: Phone,
  chat: MessageSquare,
  meeting: Users,
  note: NotebookPen,
}

function formatDateTime(iso: string): string {
  return `${formatDayMonth(iso)}, ${formatTime(iso)}`
}

type FocusItemRowProps = {
  item: FocusItem
  /** Руководителю показываем ответственного; менеджер и так видит только свои лиды */
  showManager: boolean
  /** Подпись для ИИ-рекомендаций на демо-данных */
  isDemoData: boolean
}

export function FocusItemRow({ item, showManager, isDemoData }: FocusItemRowProps) {
  const priority = PRIORITY_META[item.priority]
  const ChannelIcon = item.lastInteraction ? CHANNEL_ICONS[item.lastInteraction.channel] : null

  return (
    <li className="relative flex flex-col gap-3 overflow-hidden rounded-lg border bg-card py-3 pr-3 pl-5 sm:flex-row sm:gap-4">
      <span className={cn("absolute inset-y-0 left-0 w-1", priority.barClass)} aria-hidden />
      <span className="sr-only">{priority.label}.</span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={leadRoute(item.lead.id)}
            className="font-semibold hover:text-primary hover:underline focus-visible:text-primary focus-visible:outline-none"
          >
            {item.lead.name}
          </Link>
          <span className="text-xs text-muted-foreground">
            {item.stageName} · {item.pipelineName}
          </span>
          <span className="inline-flex items-center rounded-md bg-warning/12 px-1.5 py-0.5 text-xs font-medium text-warning">
            {item.reason.label}
            {item.reason.since && ` с ${formatDayMonth(item.reason.since)}`}
          </span>
          {showManager && (
            <span className="text-xs text-muted-foreground">· {item.manager.name}</span>
          )}
        </div>

        {item.lastInteraction && ChannelIcon && (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <ChannelIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="text-foreground/90">{item.lastInteraction.summary}</span>
              {" · "}
              {formatDateTime(item.lastInteraction.at)}
            </span>
          </p>
        )}

        <p className="flex items-center gap-1.5 text-sm">
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {item.nextAction ? (
            <span>
              {item.nextAction.title}
              {item.nextAction.dueAt && (
                <span className="text-muted-foreground"> · до {formatDateTime(item.nextAction.dueAt)}</span>
              )}
            </span>
          ) : (
            <span className="font-medium text-warning">Следующий шаг не назначен</span>
          )}
        </p>

        {item.aiRecommendation && (
          <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/8 px-2.5 py-2 text-sm">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            <p>
              <span className="font-medium text-primary">
                Рекомендация ИИ{isDemoData && " · демо"}:
              </span>{" "}
              {item.aiRecommendation}
            </p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-start gap-1">
        <Button variant="outline" size="sm" disabled title="Станет доступно после подключения backend">
          <AlarmClock data-icon="inline-start" aria-hidden />
          Отложить
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled
          title="Станет доступно после подключения backend"
          aria-label="Убрать из фокуса"
        >
          <X aria-hidden />
        </Button>
      </div>
    </li>
  )
}
