import { ApiErrorState } from "@/components/shared/api-error-state"
import { MetricHint } from "@/components/shared/metric-hint"
import { fetchMyMonth, percentOf, type MyMonth } from "@/features/my-day/api/my-month"
import { tryLoad } from "@/lib/api/load"
import { formatDecimal, formatDecimalMoney, formatNumber } from "@/lib/format"

/** Определения — как их считает backend (`/team/my-month/`) */
const RULES = {
  sales: "Сделки, первая подтверждённая оплата по которым пришлась на этот месяц. Каждая новая сделка — отдельная продажа.",
  prepayments: "Подтверждённые предоплаты, полученные вами в этом месяце.",
  debt: "Сколько клиенты ещё должны доплатить по продажам этого месяца.",
  meetings: "Ваши встречи этого месяца со статусом «Состоялась». Доходимость — состоявшиеся из уже прошедших.",
  received: "Все подтверждённые деньги этого месяца — предоплаты, доплаты и полные оплаты — за вычетом возвратов.",
} as const

/** «Этот месяц»: плитки, показатели месяца и блоки продуктов компании */
export async function MonthOverview() {
  const result = await tryLoad(fetchMyMonth)
  if (!result.ok) return <ApiErrorState error={result.error} bare />
  const month = result.data
  return (
    <div className="space-y-4">
      <MonthTiles month={month} />
      <MonthIndicators month={month} />
      {month.products.length > 0 && <ProductBlocks month={month} />}
    </div>
  )
}

function MonthTiles({ month }: { month: MyMonth }) {
  const money = (value: string) => formatDecimalMoney(value, month.currency)
  const salesTarget = month.targets.sales
  const attendance = month.meetings.attendancePercent
  const tiles = [
    {
      label: "Продажи",
      value: formatNumber(month.sales),
      note: salesTarget !== null ? `план ${formatNumber(Number(salesTarget))} · было ${formatNumber(month.previousSales)}` : `в прошлом месяце ${formatNumber(month.previousSales)}`,
      hint: RULES.sales,
    },
    { label: "Предоплаты", value: money(month.money.prepayments), note: null, hint: RULES.prepayments },
    { label: "Долг клиентов", value: money(month.debt), note: null, hint: RULES.debt },
    {
      label: "Встречи состоялись",
      value: formatNumber(month.meetings.held),
      note: attendance !== null ? `доходимость ${formatDecimal(Number(attendance))}%` : null,
      hint: RULES.meetings,
    },
    { label: "Получено", value: money(month.money.received), note: null, hint: RULES.received },
  ]
  return (
    <section aria-labelledby="month-tiles" className="space-y-2.5">
      <h2 id="month-tiles" className="text-base font-semibold">
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
            {tile.note && <dd className="text-xs text-muted-foreground">{tile.note}</dd>}
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Воронка месяца: назначено → прошло → состоялось → продажи; полосы — доля от назначенных */
function MonthIndicators({ month }: { month: MyMonth }) {
  const { meetings } = month
  const perMeeting = meetings.salesPerMeetingPercent
  const rows = [
    { label: "Назначено на меня", value: meetings.assigned, note: "на даты месяца" },
    {
      label: "Уже прошли",
      value: meetings.passed,
      note: meetings.ahead > 0 ? `ещё ${formatNumber(meetings.ahead)} впереди` : meetings.assigned > 0 ? "все прошли" : "—",
    },
    {
      label: "Состоялись",
      value: meetings.held,
      note: meetings.attendancePercent !== null ? `доходимость ${formatDecimal(Number(meetings.attendancePercent))}%` : "—",
    },
    { label: "Продажи месяца", value: month.sales, note: perMeeting !== null ? `продажи / встречи ${formatDecimal(Number(perMeeting))}%` : "—" },
  ]
  return (
    <section aria-labelledby="month-indicators" className="space-y-2.5 rounded-xl px-4 py-3 ring-1 ring-border">
      <h2 id="month-indicators" className="text-sm font-semibold">
        Показатели месяца <span className="font-normal text-muted-foreground">· встречи по дате встречи, продажи по оплате</span>
      </h2>
      <dl className="space-y-2">
        {rows.map((row) => {
          const width = percentOf(row.value, meetings.assigned) ?? 0
          return (
            <div key={row.label} className="grid grid-cols-[9rem_1fr] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_11rem]">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="relative h-7 overflow-hidden rounded-md bg-muted/40">
                <div className="absolute inset-y-0 left-0 rounded-md bg-primary/25" style={{ width: `${Math.min(width, 100)}%` }} aria-hidden />
                <span className="relative flex h-full items-center px-2 font-semibold tabular-nums">{formatNumber(row.value)}</span>
              </dd>
              <dd className="col-span-2 text-xs text-muted-foreground sm:col-span-1 sm:text-right">{row.note}</dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

/** Продукты компании, которые директор или РОП включил в «Мой день» */
function ProductBlocks({ month }: { month: MyMonth }) {
  const money = (value: string) => formatDecimalMoney(value, month.currency)
  return (
    <section aria-labelledby="month-products" className="space-y-2.5">
      <h2 id="month-products" className="text-base font-semibold">
        Продажи по продуктам
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {month.products.map((product) => {
          const share = percentOf(product.turnover, month.turnover)
          return (
            <li key={product.productId} className="space-y-2 rounded-xl px-4 py-3 ring-1 ring-border">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-medium">{product.name}</h3>
                {share !== null && <span className="text-meta text-muted-foreground">{formatNumber(share)}% оборота</span>}
              </div>
              <p className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">{formatNumber(product.sales)}</span>
                <span className="text-sm text-muted-foreground">продаж · было {formatNumber(product.previousSales)}</span>
              </p>
              <dl className="divide-y text-sm">
                {[
                  ["Оборот", money(product.turnover)],
                  ["Предоплаты", money(product.money.prepayments)],
                  ["Доплаты", money(product.money.additional)],
                  ["Средний чек", product.averageCheck !== null ? money(product.averageCheck) : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 py-1.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
