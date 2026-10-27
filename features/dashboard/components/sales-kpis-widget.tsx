import { TrendIndicator } from "@/components/shared/trend-indicator"
import { dashboardRepository } from "@/features/dashboard/api/dashboard-repository"
import { KpiCard, KpiCardSkeleton } from "@/features/dashboard/components/kpi-card"
import { PlanProgressBar } from "@/features/dashboard/components/plan-progress-bar"
import { expectedProgress, paceStatus } from "@/features/dashboard/lib/plan-pace"
import { formatMoney, formatNumber, formatPercent } from "@/lib/format"

const GRID_CLASSES = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
const COMPARISON_NOTE = "к тому же периоду прошлого месяца"

export async function SalesKpisWidget() {
  const { period, revenue, wonDeals, conversionRate, averageDealSize } =
    await dashboardRepository.getSalesSummary()

  const planRatio = revenue.plan === 0 ? 0 : revenue.value / revenue.plan

  return (
    <section aria-label={`Ключевые показатели, ${period.label}`} className={GRID_CLASSES}>
      <KpiCard
        label="Выручка"
        value={formatMoney(revenue.value)}
        trend={<TrendIndicator current={revenue.value} previous={revenue.previous} />}
      >
        <PlanProgressBar
          ratio={planRatio}
          expectedRatio={expectedProgress(period)}
          status={paceStatus(revenue.value, revenue.plan, period)}
          className="mb-2"
        />
        {formatPercent(planRatio)} плана · план {formatMoney(revenue.plan)}
      </KpiCard>
      <KpiCard
        label="Выигранные сделки"
        value={formatNumber(wonDeals.value)}
        trend={<TrendIndicator current={wonDeals.value} previous={wonDeals.previous} />}
      >
        {COMPARISON_NOTE}
      </KpiCard>
      <KpiCard
        label="Конверсия в продажу"
        value={formatPercent(conversionRate.value)}
        trend={
          <TrendIndicator
            current={conversionRate.value}
            previous={conversionRate.previous}
            mode="points"
          />
        }
      >
        от нового лида до оплаты
      </KpiCard>
      <KpiCard
        label="Средний чек"
        value={formatMoney(averageDealSize.value)}
        trend={
          <TrendIndicator current={averageDealSize.value} previous={averageDealSize.previous} />
        }
      >
        {COMPARISON_NOTE}
      </KpiCard>
    </section>
  )
}

export function SalesKpisSkeleton() {
  return (
    <div className={GRID_CLASSES}>
      {Array.from({ length: 4 }, (_, index) => (
        <KpiCardSkeleton key={index} />
      ))}
    </div>
  )
}
