import { Fragment, Suspense } from "react"
import Link from "next/link"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { WidgetErrorBoundary } from "@/components/shared/widget-error-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import { routes } from "@/config/routes"
import { fetchServerDay } from "@/features/my-day/api/my-day-server"
import { FocusDeals, FocusDealsSkeleton } from "@/features/my-day/components/focus-deals"
import { MonthOverview } from "@/features/my-day/components/month-overview"
import { MonthSummary } from "@/features/my-day/components/month-summary"
import { WorkSessionCard } from "@/features/my-day/components/work-session-card"
import { fetchEffectiveLayout, type WorkspaceBlockId } from "@/features/workspace"
import { DEFAULT_LAYOUT } from "@/features/workspace/lib/blocks"
import { tryLoad } from "@/lib/api/load"
import { formatNumber } from "@/lib/format"

/**
 * «Мой день» в режиме api: только то, что считает backend. Наверху — смена, затем дела на
 * сегодня, оборот и заработок, месяц и продукты. Порядок и видимость блоков задаёт руководитель
 * в «Рабочем пространстве»; если раскладку загрузить не удалось — порядок по умолчанию.
 */
export async function ServerMyDayView({ userId }: { userId: string }) {
  const [result, layout] = await Promise.all([tryLoad(() => fetchServerDay(userId)), tryLoad(fetchEffectiveLayout)])
  if (!result.ok) return <ApiErrorState error={result.error} />
  const day = result.data

  const blocks: Record<WorkspaceBlockId, React.ReactNode> = {
    work_session: <WorkSessionCard session={day.session} />,
    counters: (
      <div className="grid gap-3 sm:grid-cols-3">
        <Counter label="Задачи на сегодня" value={day.tasksToday} href={routes.tasks} />
        <Counter label="Просроченные задачи" value={day.tasksOverdue} href={routes.tasks} tone="danger" />
        <Counter label="Встречи сегодня" value={day.meetingsToday} href={routes.meetings} />
      </div>
    ),
    plans: (
      <WidgetErrorBoundary title="Оборот и заработок">
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
          <MonthSummary />
        </Suspense>
      </WidgetErrorBoundary>
    ),
    month_metrics: (
      <WidgetErrorBoundary title="Этот месяц">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <MonthOverview />
        </Suspense>
      </WidgetErrorBoundary>
    ),
    focus_deals: (
      <WidgetErrorBoundary title="Сделки в приоритете">
        <Suspense fallback={<FocusDealsSkeleton />}>
          <FocusDeals userId={userId} />
        </Suspense>
      </WidgetErrorBoundary>
    ),
  }
  const order = layout.ok ? layout.data.blocks : DEFAULT_LAYOUT

  return (
    <div className="space-y-4">
      {order.filter((block) => block.visible).map((block) => (
        <Fragment key={block.id}>{blocks[block.id]}</Fragment>
      ))}
    </div>
  )
}

function Counter({ label, value, href, tone = "default" }: { label: string; value: number; href: string; tone?: "default" | "danger" }) {
  return (
    <Link href={href} className="rounded-xl px-4 py-3 ring-1 ring-border transition-colors hover:bg-muted/50">
      <p className="text-meta text-muted-foreground">{label}</p>
      <p className={tone === "danger" && value > 0 ? "text-2xl font-semibold text-destructive tabular-nums" : "text-2xl font-semibold tabular-nums"}>
        {formatNumber(value)}
      </p>
    </Link>
  )
}
