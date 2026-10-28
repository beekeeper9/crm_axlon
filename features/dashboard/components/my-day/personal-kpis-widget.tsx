import { cn } from "cn"

import { TrendIndicator } from "@/components/shared/trend-indicator"
import { dashboardRepository } from "@/features/dashboard/api/dashboard-repository"
import { KpiCard, KpiCardSkeleton } from "@/features/dashboard/components/kpi-card"
import { formatNumber, formatPercent } from "@/lib/format"

const GRID_CLASSES = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"

export async function PersonalKpisWidget() {
  const { sales, salesPerMeeting, averageDeal, meetings } = await dashboardRepository.getPersonalKpis()

  const belowBonus =
    salesPerMeeting.bonusThreshold !== null && salesPerMeeting.ratio < salesPerMeeting.bonusThreshold

  return (
    <section aria-label="Личные показатели месяца" className={GRID_CLASSES}>
      <KpiCard
        label="Продажи"
        value={formatNumber(sales.value)}
        trend={<TrendIndicator current={sales.value} previous={sales.previous} />}
      >
        {sales.plan === null ? "план РОП не задал" : `план ${formatNumber(sales.plan)}`}
      </KpiCard>
      <KpiCard
        label="Продажи / встречи"
        value={formatPercent(salesPerMeeting.ratio)}
        valueClassName={cn(belowBonus ? "text-warning" : "text-success")}
      >
        {formatNumber(salesPerMeeting.sales)} продаж / {formatNumber(salesPerMeeting.meetingsHeld)} состоявшихся встреч
        {salesPerMeeting.bonusThreshold !== null &&
          ` · порог премии ${formatPercent(salesPerMeeting.bonusThreshold)}`}
      </KpiCard>
      <KpiCard label="Средний чек" value={formatNumber(averageDeal.value)}>
        {averageDeal.note}
      </KpiCard>
      <KpiCard label="Встречи состоялись" value={formatNumber(meetings.held)}>
        доходимость {formatPercent(meetings.attendanceRate)} · впереди {formatNumber(meetings.upcoming)}
      </KpiCard>
    </section>
  )
}

export function PersonalKpisSkeleton() {
  return (
    <div className={GRID_CLASSES}>
      {Array.from({ length: 4 }, (_, index) => (
        <KpiCardSkeleton key={index} />
      ))}
    </div>
  )
}
