import { CircleDollarSign } from "lucide-react"

import { WidgetCard } from "@/components/shared/widget-card"
import { dashboardRepository } from "@/features/dashboard/api/dashboard-repository"
import { formatMoney, formatNumber } from "@/lib/format"
import { localeConfig } from "@/config/locale"

export const EARNINGS_TITLE = "Мой заработок за месяц"

/** Только отображение: суммы и строки расчёта приходят с backend. */
export async function EarningsWidget() {
  const { total, notice, lines, footnote } = await dashboardRepository.getEarnings()

  return (
    <WidgetCard
      title={EARNINGS_TITLE}
      action={<CircleDollarSign className="size-4 text-muted-foreground" aria-hidden />}
      contentClassName="space-y-3"
    >
      <p className="text-3xl font-semibold tracking-tight">
        {formatNumber(total)}{" "}
        <span className="text-base font-normal text-muted-foreground">{localeConfig.currencyLabel}</span>
      </p>

      {notice && (
        <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          <p className="font-medium">{notice.title}</p>
          <p className="text-primary/85">{notice.text}</p>
        </div>
      )}

      <dl className="divide-y text-sm">
        {lines.map((line) => (
          <div key={line.label} className="flex items-start justify-between gap-4 py-2">
            <dt>
              {line.label}
              {line.note && <span className="block text-xs text-muted-foreground">{line.note}</span>}
            </dt>
            <dd className="font-semibold whitespace-nowrap">{formatMoney(line.amount)}</dd>
          </div>
        ))}
      </dl>

      {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
    </WidgetCard>
  )
}
