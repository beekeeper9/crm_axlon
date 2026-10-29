import Link from "next/link"
import {
  CalendarCheck,
  CircleDashed,
  ClipboardPen,
  History,
  ListTodo,
  MessageSquareReply,
  PartyPopper,
  type LucideIcon,
} from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { leadRoute, routes } from "@/config/routes"
import { myDayRepository } from "@/features/my-day/api/my-day-repository"
import type { TodayAction, TodayActionKind, Urgency } from "@/features/my-day/schemas"
import { tryLoad } from "@/lib/api/load"
import { formatDateTime, formatDecimalMoney, formatNumber, formatTime, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

const KIND_META: Record<TodayActionKind, { icon: LucideIcon; action: string; href: (action: TodayAction) => string }> = {
  reply: { icon: MessageSquareReply, action: "Ответить", href: (action) => leadRoute(action.lead.id) },
  meeting_outcome: { icon: ClipboardPen, action: "Записать итог", href: () => routes.afterMeeting },
  overdue_task: { icon: ListTodo, action: "К задаче", href: (action) => leadRoute(action.lead.id) },
  confirm_meeting: { icon: CalendarCheck, action: "Подтвердить", href: () => routes.meetings },
  no_next_step: { icon: CircleDashed, action: "Назначить шаг", href: (action) => leadRoute(action.lead.id) },
  stale_deal: { icon: History, action: "Открыть", href: (action) => leadRoute(action.lead.id) },
}

const URGENCY_GROUPS: readonly { id: Urgency; title: string; hint: string; tone: string }[] = [
  { id: "now", title: "Сейчас", hint: "клиент ждёт или срок прошёл", tone: "text-destructive" },
  { id: "today", title: "Сегодня", hint: "до конца дня", tone: "text-warning" },
  { id: "soon", title: "Не забыть", hint: "на этой неделе", tone: "text-muted-foreground" },
]

function whenLabel(action: TodayAction): string | null {
  if (action.detail) return action.detail
  if (!action.at) return null
  if (action.kind === "overdue_task") return `срок был ${formatDateTime(action.at)}`
  if (action.kind === "confirm_meeting") return `встреча ${formatDateTime(action.at)}`
  return formatDateTime(action.at)
}

function ActionRow({ action }: { action: TodayAction }) {
  const meta = KIND_META[action.kind]
  const when = whenLabel(action)
  return (
    <li className="group/action relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40 focus-within:bg-accent/40">
      <meta.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <Link href={meta.href(action)} className="text-sm font-medium after:absolute after:inset-0 focus-visible:outline-none">
          {action.lead.name}
        </Link>
        <p className="text-meta text-foreground/85">{action.problem}</p>
        {(when || action.amount) && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {[when, action.amount && action.currency ? formatDecimalMoney(action.amount, action.currency) : null].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <span className="shrink-0 self-center rounded-md px-2 py-1 text-meta font-medium text-primary group-hover/action:bg-primary/10 max-sm:hidden">
        {meta.action} →
      </span>
    </li>
  )
}

/** Главный блок менеджера: конкретные дела, сгруппированные по срочности, каждое ведёт к нужной записи */
export async function TodayActions() {
  const result = await tryLoad(() => myDayRepository.getTodayActions())
  if (!result.ok) return <ApiErrorState error={result.error} />
  const { actions, asOf } = result.data
  const urgent = actions.filter((action) => action.urgency === "now").length

  return (
    <section aria-labelledby="today-actions" className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-3">
        <h2 id="today-actions" className="text-base font-semibold">
          Что сделать сегодня
        </h2>
        <p className="text-meta text-muted-foreground">
          {actions.length > 0
            ? `${formatNumber(actions.length)} ${pluralize(actions.length, ["дело", "дела", "дел"])}${urgent > 0 ? ` · ${formatNumber(urgent)} срочно` : ""} · на ${formatTime(asOf)}`
            : `на ${formatTime(asOf)}`}
        </p>
      </header>
      {actions.length === 0 ? (
        <div className="flex items-center gap-3 border-t px-4 py-6 text-sm">
          <PartyPopper className="size-5 text-success" aria-hidden />
          Срочных дел нет: клиенты получили ответы, итоги записаны, у сделок есть следующий шаг.
        </div>
      ) : (
        URGENCY_GROUPS.map((group) => {
          const items = actions.filter((action) => action.urgency === group.id)
          if (items.length === 0) return null
          return (
            <div key={group.id} className="border-t">
              <h3 className="flex items-baseline gap-2 px-4 pt-2.5 pb-1 text-xs">
                <span className={cn("font-semibold", group.tone)}>{group.title}</span>
                <span className="text-muted-foreground">{group.hint}</span>
              </h3>
              <ul className="divide-y divide-border/60">
                {items.map((action) => (
                  <ActionRow key={action.id} action={action} />
                ))}
              </ul>
            </div>
          )
        })
      )}
    </section>
  )
}

export function TodayActionsSkeleton() {
  return <Skeleton className="h-96 w-full rounded-xl" aria-busy="true" />
}
