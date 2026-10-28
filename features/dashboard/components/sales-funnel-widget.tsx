import { ArrowRight, Filter } from "lucide-react"
import { cn } from "@/lib/utils"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { WidgetCard } from "@/components/shared/widget-card"
import { dashboardRepository } from "@/features/dashboard/api/dashboard-repository"
import { findBottleneckStageId } from "@/features/dashboard/lib/funnel"
import { formatDecimal, formatMoney, formatNumber, formatPercent } from "@/lib/format"

export const SALES_FUNNEL_TITLE = "Воронка продаж"

const ROW_GRID =
  "grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-x-4 gap-y-1 px-2 md:grid-cols-[9.5rem_minmax(0,1fr)_7.5rem_4.5rem_4.5rem]"

export async function SalesFunnelWidget() {
  const { pipelineName, stages } = await dashboardRepository.getSalesFunnel()
  const bottleneckId = findBottleneckStageId(stages)
  const maxCount = Math.max(...stages.map((stage) => stage.dealsCount), 1)

  return (
    <WidgetCard
      title={SALES_FUNNEL_TITLE}
      description={`${pipelineName} · сделки текущего месяца по этапам`}
      action={
        bottleneckId && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Отмечен этап с самой низкой конверсией
          </span>
        )
      }
    >
      {stages.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="В воронке нет этапов"
          description="Этапы настраиваются в рабочем пространстве отдела."
        />
      ) : (
        <div className="space-y-1">
        <div
          className={cn(ROW_GRID, "hidden pb-1 text-xs text-muted-foreground md:grid")}
          aria-hidden
        >
          <span>Этап</span>
          <span>Сделки</span>
          <span className="text-right">Сумма</span>
          <span className="text-right">Переход</span>
          <span className="text-right">Ср. срок</span>
        </div>
        <ol className="space-y-1">
          {stages.map((stage) => {
            const isBottleneck = stage.id === bottleneckId
            return (
              <li
                key={stage.id}
                className={cn(ROW_GRID, "rounded-md py-2", isBottleneck && "bg-warning/8")}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{stage.name}</span>
                  {isBottleneck && (
                    <StatusBadge tone="warning" className="mt-1 w-fit">
                      Узкое место
                    </StatusBadge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="h-6 flex-1">
                    <div
                      className={cn(
                        "flex h-full min-w-8 items-center rounded-sm px-2 text-xs font-medium text-primary-foreground",
                        isBottleneck ? "bg-warning" : "bg-chart-1"
                      )}
                      style={{ width: `${(stage.dealsCount / maxCount) * 100}%` }}
                    >
                      {formatNumber(stage.dealsCount)}
                    </div>
                  </div>
                </div>

                <div className="col-start-2 text-xs text-muted-foreground md:col-start-auto md:text-right md:text-sm md:text-foreground">
                  {formatMoney(stage.amount)}
                </div>

                <div
                  className={cn(
                    "col-start-2 flex items-center gap-1 text-xs md:col-start-auto md:justify-end md:text-sm",
                    isBottleneck ? "font-medium text-warning" : "text-muted-foreground"
                  )}
                >
                  {stage.conversionToNext !== null && (
                    <>
                      <ArrowRight className="size-3.5" aria-hidden />
                      <span>
                        {formatPercent(stage.conversionToNext)}
                        <span className="sr-only"> переходят на следующий этап</span>
                      </span>
                    </>
                  )}
                </div>

                <div className="col-start-2 text-xs text-muted-foreground md:col-start-auto md:text-right">
                  {stage.averageDaysInStage > 0 &&
                    `${formatDecimal(stage.averageDaysInStage)} дн.`}
                </div>
              </li>
            )
          })}
        </ol>
        </div>
      )}
    </WidgetCard>
  )
}
