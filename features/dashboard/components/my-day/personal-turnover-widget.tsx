import { Wallet } from "lucide-react"

import { WidgetCard } from "@/components/shared/widget-card"
import { dashboardRepository } from "@/features/dashboard/api/dashboard-repository"
import { PlanProgressBar } from "@/features/dashboard/components/plan-progress-bar"
import { cn } from "@/lib/utils"

import { expectedProgress, paceStatusByRatio } from "@/features/dashboard/lib/plan-pace"
import {
  formatDayMonth,
  formatMoney,
  formatNumber,
  formatPercent,
  formatSignedNumber,
} from "@/lib/format"

export const PERSONAL_TURNOVER_TITLE = "Оборот месяца"

export async function PersonalTurnoverWidget() {
  const data = await dashboardRepository.getPersonalTurnover()
  const { period, turnover, plan, planToDate, forecast, growth } = data

  const planRatio = plan ? turnover / plan : null
  // Ожидаемый темп берём из плана к сегодня от backend; если его нет — равномерный по дням
  const expectedRatio = plan && planToDate !== null ? planToDate / plan : expectedProgress(period)

  return (
    <WidgetCard
      title={PERSONAL_TURNOVER_TITLE}
      description={plan ? `${period.label} · ориентир ${formatMoney(plan)}` : `${period.label} · ориентир не задан`}
      action={<Wallet className="size-4 text-muted-foreground" aria-hidden />}
      contentClassName="space-y-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-4xl font-semibold tracking-tight">{formatNumber(turnover)}</p>
        {planRatio !== null && (
          <span className="text-sm text-muted-foreground">{formatPercent(planRatio)} плана</span>
        )}
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-xs font-medium",
            growth.value >= 0 ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive"
          )}
        >
          {formatSignedNumber(growth.value)} к {formatDayMonth(growth.comparedTo)}
        </span>
      </div>

      {plan !== null && planRatio !== null && (
        <PlanProgressBar
          ratio={planRatio}
          expectedRatio={expectedRatio}
          status={paceStatusByRatio(planRatio, expectedRatio)}
          className="h-2"
        />
      )}

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {planToDate !== null && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">к сегодня по плану</dt>
            <dd className="font-medium">{formatNumber(planToDate)}</dd>
          </div>
        )}
        {forecast !== null && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">при таком темпе к концу месяца ≈</dt>
            <dd className="font-medium">{formatNumber(forecast)}</dd>
          </div>
        )}
      </dl>

      <dl className="grid gap-4 border-t pt-3 text-sm sm:grid-cols-2">
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Предоплаты</dt>
          <dd className="font-semibold">{formatMoney(data.prepayments)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Доплаты</dt>
          <dd className="font-semibold">{formatMoney(data.additionalPayments)}</dd>
        </div>
      </dl>
    </WidgetCard>
  )
}
