import {
  CalendarX2,
  CircleCheck,
  CircleDashed,
  Hourglass,
  TrendingDown,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { WidgetCard } from "@/components/shared/widget-card"
import { dashboardRepository } from "@/features/dashboard/api/dashboard-repository"
import type { AttentionItem } from "@/features/dashboard/schemas"
import { formatNumber } from "@/lib/format"

export const ATTENTION_TITLE = "Требует внимания"

const KIND_ICONS: Record<AttentionItem["kind"], LucideIcon> = {
  behind_plan: TrendingDown,
  stalled_deal: Hourglass,
  overdue_tasks: CalendarX2,
  no_next_step: CircleDashed,
}

const SEVERITY_META: Record<AttentionItem["severity"], { label: string; className: string }> = {
  high: { label: "Высокий приоритет", className: "bg-destructive/10 text-destructive" },
  medium: { label: "Средний приоритет", className: "bg-warning/12 text-warning" },
}

export async function AttentionWidget() {
  const { items } = await dashboardRepository.getAttentionList()

  return (
    <WidgetCard
      title={ATTENTION_TITLE}
      description="Что стоит сделать руководителю сегодня"
      action={items.length > 0 && <StatusBadge tone="neutral">{formatNumber(items.length)}</StatusBadge>}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title="Всё под контролем"
          description="Нет отстающих менеджеров, зависших сделок и просрочек."
        />
      ) : (
        <ul className="-my-2 divide-y">
          {items.map((item) => {
            const Icon = KIND_ICONS[item.kind]
            const severity = SEVERITY_META[item.severity]
            return (
              <li key={item.id} className="flex gap-3 py-3">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md",
                    severity.className
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="sr-only">{severity.label}</span>
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </WidgetCard>
  )
}
