import Link from "next/link"
import {
  AlarmClock,
  CalendarCheck,
  CalendarClock,
  CircleDashed,
  MessageSquare,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { Skeleton } from "@/components/ui/skeleton"
import { routes } from "@/config/routes"
import { dashboardRepository } from "@/features/dashboard/api/dashboard-repository"
import { formatNumber } from "@/lib/format"

type Tone = "neutral" | "warning" | "danger" | "success"

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-border bg-card text-foreground",
  success: "border-success/25 bg-success/8 text-foreground [&_strong]:text-success",
  warning: "border-warning/30 bg-warning/10 text-foreground [&_strong]:text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-foreground [&_strong]:text-destructive",
}

type NowChipProps = {
  href: string
  icon: LucideIcon
  value: string
  label: string
  tone: Tone
}

function NowChip({ href, icon: Icon, value, label, tone }: NowChipProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        TONE_CLASSES[tone]
      )}
    >
      <Icon className="size-4 text-muted-foreground" aria-hidden />
      <strong className="font-semibold">{value}</strong>
      <span className="text-muted-foreground">{label}</span>
    </Link>
  )
}

/** «Сейчас»: что требует действия прямо сейчас. Каждая плитка ведёт в нужный раздел. */
export async function NowStripWidget() {
  const now = await dashboardRepository.getNowSummary()

  return (
    <section aria-label="Сейчас" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm text-muted-foreground">Сейчас</span>
      <NowChip
        href={routes.focus}
        icon={MessageSquare}
        value={formatNumber(now.awaitingReply)}
        label="ждут ответа"
        tone={now.awaitingReply > 0 ? "warning" : "success"}
      />
      <NowChip
        href={routes.meetings}
        icon={CalendarCheck}
        value={`${formatNumber(now.meetingsToday.held)} из ${formatNumber(now.meetingsToday.total)}`}
        label="встреч сегодня состоялось"
        tone="neutral"
      />
      {/* По инструкции «Задачи, Фокус и Мой день» эти плитки видны только когда не ноль */}
      {now.meetingsWithoutOutcome > 0 && (
        <NowChip
          href={routes.afterMeeting}
          icon={CircleDashed}
          value={formatNumber(now.meetingsWithoutOutcome)}
          label="встреч без итога"
          tone="warning"
        />
      )}
      {now.reschedulesWithoutDate > 0 && (
        <NowChip
          href={routes.meetings}
          icon={CalendarClock}
          value={formatNumber(now.reschedulesWithoutDate)}
          label="переносов без даты"
          tone="warning"
        />
      )}
      <NowChip
        href={routes.tasks}
        icon={AlarmClock}
        value={formatNumber(now.tasks.overdue)}
        label={`задач просрочено · ${formatNumber(now.tasks.dueToday)} на сегодня`}
        tone={now.tasks.overdue > 0 ? "danger" : "neutral"}
      />
    </section>
  )
}

export function NowStripSkeleton() {
  return (
    <div className="flex flex-wrap gap-2" aria-busy="true">
      {[176, 240, 168, 184, 280].map((width) => (
        <Skeleton key={width} className="h-9 rounded-lg" style={{ width }} />
      ))}
    </div>
  )
}
