import { WidgetCard } from "@/components/shared/widget-card"
import { dashboardRepository } from "@/features/dashboard/api/dashboard-repository"
import { formatNumber, formatPercent } from "@/lib/format"

export const MEETINGS_FUNNEL_TITLE = "Показатели месяца"

export async function MeetingsFunnelWidget() {
  const { monthFunnel: funnel } = await dashboardRepository.getPersonalKpis()
  const max = Math.max(funnel.assigned, 1)

  const rows = [
    { label: "Назначено на меня", value: funnel.assigned, hint: "на даты месяца" },
    { label: "Уже прошли", value: funnel.passed, hint: `ещё ${formatNumber(funnel.assigned - funnel.passed)} впереди` },
    {
      label: "Состоялись",
      value: funnel.held,
      hint: `доходимость ${formatPercent(funnel.passed === 0 ? 0 : funnel.held / funnel.passed)}`,
    },
    {
      label: "Продажи месяца",
      value: funnel.sales,
      hint: `продажи / встречи ${formatPercent(funnel.held === 0 ? 0 : funnel.sales / funnel.held)}`,
    },
  ]

  return (
    <WidgetCard
      title={MEETINGS_FUNNEL_TITLE}
      description="Встречи — по дате встречи, продажи — по дате оплаты"
    >
      <dl className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 sm:grid-cols-[9.5rem_minmax(0,1fr)_10rem]">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="h-7 rounded-md bg-muted">
              <div
                className="flex h-full min-w-9 items-center rounded-md bg-primary/25 px-2 text-sm font-semibold"
                style={{ width: `${(row.value / max) * 100}%` }}
              >
                {formatNumber(row.value)}
              </div>
            </dd>
            <dd className="col-start-2 text-xs text-muted-foreground sm:col-start-auto sm:text-right">
              {row.hint}
            </dd>
          </div>
        ))}
      </dl>
    </WidgetCard>
  )
}
