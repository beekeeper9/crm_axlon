import { Suspense } from "react"
import Link from "next/link"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { ListPanel } from "@/components/shared/list-panel"
import { WidgetErrorBoundary } from "@/components/shared/widget-error-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import { routes } from "@/config/routes"
import { fetchServerDay, type PlanProgress } from "@/features/my-day/api/my-day-server"
import { FocusDeals, FocusDealsSkeleton } from "@/features/my-day/components/focus-deals"
import { MonthMetrics } from "@/features/my-day/components/month-metrics"
import { WorkSessionCard } from "@/features/my-day/components/work-session-card"
import { tryLoad } from "@/lib/api/load"
import { formatDecimal, formatDecimalMoney, formatNumber } from "@/lib/format"

const METRIC_LABELS: Record<string, string> = {
  monthly_sales: "Продажи за месяц",
  monthly_turnover: "Оборот за месяц",
  weekly_leads: "Лиды за неделю",
  weekly_prepayments: "Предоплаты за неделю",
  daily_calls: "Звонки за день",
}

function amount(plan: PlanProgress, value: string): string {
  return plan.unit === "money" && plan.currency ? formatDecimalMoney(value, plan.currency) : formatDecimal(Number(value))
}

/** «Мой день» в режиме api: только то, что считает backend */
export async function ServerMyDayView({ userId }: { userId: string }) {
  const result = await tryLoad(() => fetchServerDay(userId))
  if (!result.ok) return <ApiErrorState error={result.error} />
  const day = result.data

  return (
    <div className="space-y-4">
      <WorkSessionCard session={day.session} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Counter label="Задачи на сегодня" value={day.tasksToday} href={routes.tasks} />
        <Counter label="Просроченные задачи" value={day.tasksOverdue} href={routes.tasks} tone="danger" />
        <Counter label="Встречи сегодня" value={day.meetingsToday} href={routes.meetings} />
      </div>

      <section aria-labelledby="my-plans" className="space-y-2.5">
        <h2 id="my-plans" className="text-base font-semibold">
          Мои планы
        </h2>
        {day.plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Личный план на текущий период не задан — его ставит руководитель.</p>
        ) : (
          <ListPanel>
            <ul className="divide-y">
              {day.plans.map((plan) => {
                const percent = plan.percent === null ? null : Number(plan.percent)
                return (
                  <li key={plan.id} className="space-y-1.5 px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{METRIC_LABELS[plan.metric] ?? plan.metric}</span>
                      <span className="tabular-nums">
                        {plan.actual === null ? "—" : amount(plan, plan.actual)} из {amount(plan, plan.target)}
                        {percent !== null && <span className="text-muted-foreground"> · {formatNumber(Math.round(percent))}%</span>}
                      </span>
                    </div>
                    {percent !== null && (
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                    )}
                    {plan.remaining !== null && Number(plan.remaining) > 0 && (
                      <p className="text-meta text-muted-foreground">Осталось: {amount(plan, plan.remaining)}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          </ListPanel>
        )}
      </section>

      <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
        <MonthMetrics />
      </Suspense>

      <WidgetErrorBoundary title="Сделки в приоритете">
        <Suspense fallback={<FocusDealsSkeleton />}>
          <FocusDeals userId={userId} />
        </Suspense>
      </WidgetErrorBoundary>

      <p className="text-meta text-muted-foreground">
        Заработок, показатели по дням и направлениям появятся, когда backend начнёт их отдавать.
      </p>
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
