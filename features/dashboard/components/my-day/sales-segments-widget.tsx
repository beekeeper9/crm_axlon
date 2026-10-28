import { Layers } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Card } from "@/components/ui/card"
import { dashboardRepository } from "@/features/dashboard/api/dashboard-repository"
import { formatMoney, formatNumber, formatPercent } from "@/lib/format"

const SEGMENT_DOT_CLASSES = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"]

/** Продажи по направлениям, которые настроила компания. */
export async function SalesSegmentsWidget() {
  const { segments } = await dashboardRepository.getSalesSegments()

  if (segments.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Layers}
          title="Направления продаж не настроены"
          description="Разбивка появится, когда компания задаст направления."
        />
      </Card>
    )
  }

  return (
    <section aria-label="Продажи по направлениям" className="grid gap-4 md:grid-cols-2">
      {segments.map((segment, index) => (
        <Card key={segment.id} className="gap-3 px-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className={`size-2 rounded-full ${SEGMENT_DOT_CLASSES[index % SEGMENT_DOT_CLASSES.length]}`} aria-hidden />
              {segment.name}
            </p>
            <span className="text-xs text-muted-foreground">{formatPercent(segment.share)} оборота</span>
          </div>
          <p className="text-sm">
            <span className="text-2xl font-semibold">{formatNumber(segment.sales.value)}</span>{" "}
            <span className="text-muted-foreground">
              продаж · было {formatNumber(segment.sales.previous)}
            </span>
          </p>
          <dl className="divide-y text-sm">
            {(
              [
                ["Оборот", segment.turnover],
                ["Предоплаты", segment.prepayments],
                ["Доплаты", segment.additionalPayments],
                ["Средний чек", segment.averageDeal],
              ] as const
            ).map(([label, amount]) => (
              <div key={label} className="flex justify-between py-1.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{formatMoney(amount)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </section>
  )
}
