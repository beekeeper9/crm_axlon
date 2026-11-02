import { ApiErrorState } from "@/components/shared/api-error-state"
import { MetricHint } from "@/components/shared/metric-hint"
import { fetchMonthMetrics } from "@/features/my-day/api/my-day-server"
import { tryLoad } from "@/lib/api/load"
import { formatDecimalMoney, formatNumber } from "@/lib/format"

/** Определения — как их считает backend (`/payments/metrics/`); числа не складываются между собой */
const DEFINITIONS = {
  sales: "Сделки, первая оплата по которым пришлась на этот месяц. Каждая новая сделка — отдельная продажа, даже если клиент покупал раньше.",
  newClients: "Клиенты, чья самая первая оплата пришлась на этот месяц. Отдельный показатель — не равен числу продаж.",
  turnover: "Сумма сделок, ставших продажами в этом месяце.",
  received: "Деньги, полученные в этом месяце, за вычетом возвратов.",
  debt: "Сколько осталось доплатить по сделкам этого месяца.",
} as const

export async function MonthMetrics() {
  const result = await tryLoad(fetchMonthMetrics)
  if (!result.ok) return <ApiErrorState error={result.error} bare />
  const m = result.data
  const money = (value: string) => formatDecimalMoney(value, m.currency)
  const tiles = [
    { label: "Продажи", value: formatNumber(m.salesCount), hint: DEFINITIONS.sales },
    { label: "Новые клиенты", value: formatNumber(m.newClients), hint: DEFINITIONS.newClients },
    { label: "Оборот", value: money(m.turnover), hint: DEFINITIONS.turnover },
    { label: "Получено", value: money(m.received), hint: DEFINITIONS.received },
    { label: "Долг клиентов", value: money(m.debt), hint: DEFINITIONS.debt },
  ]
  return (
    <section aria-labelledby="month-metrics" className="space-y-2.5">
      <h2 id="month-metrics" className="text-base font-semibold">
        Этот месяц
      </h2>
      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl px-4 py-3 ring-1 ring-border">
            <dt className="flex items-center gap-1 text-meta text-muted-foreground">
              {tile.label}
              <MetricHint label={tile.label} definition={tile.hint} isOpenQuestion={false} />
            </dt>
            <dd className="text-xl font-semibold tabular-nums">{tile.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
