import { StatusBadge } from "@/components/shared/status-badge"
import { WidgetCard } from "@/components/shared/widget-card"
import { dashboardRepository } from "@/features/dashboard/api/dashboard-repository"
import { RevenueTrendChart } from "@/features/dashboard/components/revenue-trend-chart"
import {
  forecastAtPeriodEnd,
  PACE_STATUS_META,
  paceStatus,
  requiredDailyRevenue,
} from "@/features/dashboard/lib/plan-pace"
import { formatMoney, formatNumber, formatPercent } from "@/lib/format"

export const PLAN_TREND_TITLE = "Выполнение плана"

export async function PlanTrendWidget() {
  const { period, plan, points } = await dashboardRepository.getRevenueTrend()

  const actual = points.findLast((point) => point.actual !== null)?.actual ?? 0
  const forecast = forecastAtPeriodEnd(actual, period)
  const status = PACE_STATUS_META[paceStatus(actual, plan, period)]
  const daysLeft = period.daysTotal - period.daysElapsed

  const stats = [
    { label: "Факт", value: formatMoney(actual), hint: `${formatPercent(plan === 0 ? 0 : actual / plan)} плана` },
    { label: "Прогноз на конец", value: formatMoney(forecast), hint: `${formatPercent(plan === 0 ? 0 : forecast / plan)} плана при текущем темпе` },
    { label: "Нужно в день", value: formatMoney(requiredDailyRevenue(actual, plan, period)), hint: "чтобы выполнить план" },
    { label: "Осталось дней", value: formatNumber(daysLeft), hint: `из ${formatNumber(period.daysTotal)}` },
  ]

  return (
    <WidgetCard
      title={PLAN_TREND_TITLE}
      description={`${period.label} · план ${formatMoney(plan)}`}
      action={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      contentClassName="space-y-5"
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="text-base font-semibold tracking-tight">{stat.value}</dd>
            <dd className="text-xs text-muted-foreground">{stat.hint}</dd>
          </div>
        ))}
      </dl>
      <RevenueTrendChart points={points} />
    </WidgetCard>
  )
}
