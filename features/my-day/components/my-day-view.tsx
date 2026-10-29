import { Suspense } from "react"
import { CalendarX2 } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { WidgetErrorBoundary } from "@/components/shared/widget-error-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import { myDayRepository } from "@/features/my-day/api/my-day-repository"
import { FocusDeals, FocusDealsSkeleton } from "@/features/my-day/components/focus-deals"
import {
  DailyBlock,
  EarningsBlock,
  KpiBlocks,
  MonthFunnelBlock,
  NowStrip,
  SegmentBlocks,
  TurnoverBlock,
} from "@/features/my-day/components/month-blocks"
import { TodayActions, TodayActionsSkeleton } from "@/features/my-day/components/today-actions"
import { tryLoad } from "@/lib/api/load"
import { formatDecimalMoney } from "@/lib/format"

/**
 * «Мой день» менеджера: «Сейчас» → оборот и заработок → показатели →
 * что сделать сегодня и сделки в приоритете → показатели месяца и по дням → направления.
 * Только собственные данные; блоки «на сегодня» — только для текущего месяца.
 */
export async function MyDayView({ userId, month }: { userId: string; month: string }) {
  const result = await tryLoad(() => myDayRepository.getMonth(month))
  if (!result.ok) return <ApiErrorState error={result.error} />
  const data = result.data
  if (!data) {
    return (
      <ListPanel>
        <EmptyState icon={CalendarX2} title="За этот месяц данных пока нет" description="Показатели появятся, когда в CRM будут ваши сделки, встречи и оплаты за этот месяц." />
      </ListPanel>
    )
  }
  const money = (value: string) => formatDecimalMoney(value, data.currency)

  return (
    <div className="space-y-4">
      {data.now && <NowStrip now={data.now} />}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <TurnoverBlock data={data} money={money} />
        <EarningsBlock data={data} money={money} />
      </div>

      <KpiBlocks data={data} money={money} />

      {data.period.isCurrent && (
        <div className="grid gap-3 lg:grid-cols-2">
          <WidgetErrorBoundary title="Что сделать сегодня">
            <Suspense fallback={<TodayActionsSkeleton />}>
              <TodayActions />
            </Suspense>
          </WidgetErrorBoundary>
          <WidgetErrorBoundary title="Сделки в приоритете">
            <Suspense fallback={<FocusDealsSkeleton />}>
              <FocusDeals userId={userId} />
            </Suspense>
          </WidgetErrorBoundary>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <MonthFunnelBlock data={data} />
        <DailyBlock data={data} />
      </div>

      <SegmentBlocks data={data} money={money} />
    </div>
  )
}

export function MyDayViewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-9 w-full max-w-2xl" />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
