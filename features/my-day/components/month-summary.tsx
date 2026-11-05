import { Target, Wallet } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { MetricHint } from "@/components/shared/metric-hint"
import { fetchMyMonth, percentOf, type MyMonth } from "@/features/my-day/api/my-month"
import { tryLoad } from "@/lib/api/load"
import { formatDecimal, formatDecimalMoney, formatNumber } from "@/lib/format"

const TURNOVER_RULE = "Сумма сделок, первая подтверждённая оплата по которым пришлась на этот месяц. Ориентир — ваш план оборота от руководителя."
const EARNINGS_RULE =
  "Оклад плюс процент от подтверждённых в этом месяце предоплат, доплат и полных оплат по вашим продажам (возвраты вычитаются). Растёт, как только оплату подтвердят. Условия задаёт директор."

/** «Оборот месяца» и «Мой заработок за месяц» — верх личного месяца менеджера */
export async function MonthSummary() {
  const result = await tryLoad(fetchMyMonth)
  if (!result.ok) return <ApiErrorState error={result.error} bare />
  const month = result.data
  return (
    <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
      <TurnoverCard month={month} />
      <EarningsCard month={month} />
    </div>
  )
}

function TurnoverCard({ month }: { month: MyMonth }) {
  const money = (value: string) => formatDecimalMoney(value, month.currency)
  const target = month.targets.turnover
  const percent = percentOf(month.turnover, target)
  return (
    <section aria-labelledby="month-turnover" className="space-y-3 rounded-xl px-4 py-3 ring-1 ring-border">
      <h2 id="month-turnover" className="flex items-center gap-1.5 text-meta text-muted-foreground">
        <Target className="size-4" aria-hidden />
        Оборот месяца{target !== null && ` · ориентир ${money(target)}`}
        <MetricHint label="Оборот месяца" definition={TURNOVER_RULE} isOpenQuestion={false} />
      </h2>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-semibold tabular-nums">{money(month.turnover)}</span>
        {percent !== null && <span className="text-sm text-muted-foreground">{formatNumber(percent)}% плана</span>}
      </p>
      {percent !== null ? (
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Выполнение плана оборота" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percent, 100)}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
      ) : (
        <p className="text-meta text-muted-foreground">План оборота на месяц не задан — его ставит руководитель.</p>
      )}
      <dl className="grid gap-x-6 gap-y-1 border-t pt-3 text-sm sm:grid-cols-3">
        <MoneyRow label="Предоплаты" value={money(month.money.prepayments)} />
        <MoneyRow label="Доплаты" value={money(month.money.additional)} />
        <MoneyRow label="Полные оплаты" value={money(month.money.full)} />
      </dl>
    </section>
  )
}

function EarningsCard({ month }: { month: MyMonth }) {
  const money = (value: string) => formatDecimalMoney(value, month.currency)
  const earnings = month.earnings
  return (
    <section aria-labelledby="month-earnings" className="space-y-3 rounded-xl px-4 py-3 ring-1 ring-border">
      <h2 id="month-earnings" className="flex items-center gap-1.5 text-meta text-muted-foreground">
        <Wallet className="size-4" aria-hidden />
        Мой заработок за месяц
        <MetricHint label="Мой заработок за месяц" definition={EARNINGS_RULE} isOpenQuestion={false} />
      </h2>
      {earnings === null ? (
        <p className="text-sm text-muted-foreground">Оклад и процент с продаж ещё не заданы — их устанавливает директор в профиле сотрудника.</p>
      ) : (
        <>
          <p className="text-3xl font-semibold tabular-nums">{money(earnings.total)}</p>
          <dl className="space-y-1.5 border-t pt-3 text-sm">
            <MoneyRow label="Оклад" value={money(earnings.baseSalary)} />
            <MoneyRow
              label={`${formatDecimal(Number(earnings.commissionPercent))}% от полученных денег`}
              value={money(earnings.commission)}
              note={`получено ${money(month.money.received)}`}
            />
          </dl>
        </>
      )}
    </section>
  )
}

function MoneyRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">
        {label}
        {note && <span className="block text-xs">{note}</span>}
      </dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
