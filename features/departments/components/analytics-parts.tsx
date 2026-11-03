import { MetricHint } from "@/components/shared/metric-hint"
import type { PlanProgress, SalesMetrics } from "@/features/departments/api/department-analytics"
import type { Period } from "@/features/departments/lib/period"
import { formatDecimal, formatDecimalMoney, formatNumber } from "@/lib/format"
import { getParam, type SearchParamsRecord } from "@/lib/search-params"
import { cn } from "@/lib/utils"

/** Определения показателей — как их считает backend */
export const DEFINITIONS = {
  sales: "Сделки, первая оплата по которым пришлась на период. Каждая новая сделка — отдельная продажа, даже если клиент покупал раньше.",
  prepayments: "Предоплаты, полученные за период (возвраты не учитываются): сколько платежей и на какую сумму.",
  received: "Все деньги, полученные за период, за вычетом возвратов.",
  turnover: "Сумма сделок, ставших продажами за период.",
  leadsTotal: "Все входящие лиды в базе отдела.",
  leadsNew: "Входящие лиды, поступившие за выбранный период.",
} as const

const METRIC_LABELS: Record<string, string> = {
  monthly_sales: "План продаж",
  monthly_turnover: "План по обороту",
}

/** Фильтр периода «с — по»: обычная GET-форма, остальные параметры адреса сохраняются */
export function PeriodFilter({ period, params, action }: { period: Period; params: SearchParamsRecord; action: string }) {
  const keep = Object.keys(params).filter((key) => key !== "from" && key !== "to")
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 text-sm" aria-label="Период">
      {keep.map((key) => (
        <input key={key} type="hidden" name={key} value={getParam(params, key) ?? ""} />
      ))}
      <label className="grid gap-1">
        <span className="text-meta text-muted-foreground">С</span>
        <input type="date" name="from" defaultValue={period.from} className="h-8 rounded-md border bg-background px-2" />
      </label>
      <label className="grid gap-1">
        <span className="text-meta text-muted-foreground">По</span>
        <input type="date" name="to" defaultValue={period.to} className="h-8 rounded-md border bg-background px-2" />
      </label>
      <button type="submit" className="h-8 rounded-md px-3 ring-1 ring-border hover:bg-muted">
        Показать
      </button>
    </form>
  )
}

function planValue(plan: PlanProgress, value: string): string {
  return plan.unit === "money" && plan.currency ? formatDecimalMoney(value, plan.currency) : formatDecimal(Number(value))
}

/**
 * План и его выполнение. Процент и остаток — от backend; полоса — тот же процент
 * (больше 100% — полоса заполнена целиком, число показывает перевыполнение).
 */
export function PlanBar({ plan, emphasis = false }: { plan: PlanProgress; emphasis?: boolean }) {
  const percent = plan.percent === null ? null : Number(plan.percent)
  const remaining = plan.remaining === null ? null : Number(plan.remaining)
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className={cn(emphasis ? "text-base font-bold" : "text-sm font-medium")}>{METRIC_LABELS[plan.metric] ?? plan.metric}</span>
        <span className={cn("tabular-nums", emphasis ? "text-base font-bold" : "text-sm")}>
          {plan.actual === null ? "—" : planValue(plan, plan.actual)} из {planValue(plan, plan.target)}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent === null ? undefined : Math.min(Math.round(percent), 100)}
        aria-label={METRIC_LABELS[plan.metric] ?? plan.metric}
      >
        <div
          className={cn("h-full rounded-full", percent !== null && percent >= 100 ? "bg-success" : "bg-primary")}
          style={{ width: `${percent === null ? 0 : Math.min(percent, 100)}%` }}
        />
      </div>
      <p className="text-meta text-muted-foreground">
        {percent === null ? "Выполнение не считается: цель равна нулю" : `Выполнено ${formatNumber(Math.round(percent))}%`}
        {remaining !== null && remaining > 0 && ` · до плана не хватает ${planValue(plan, plan.remaining ?? "0")}`}
        {remaining !== null && remaining <= 0 && percent !== null && " · план выполнен"}
      </p>
    </div>
  )
}

export function Figure({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "muted" }) {
  return (
    <div className="rounded-xl px-4 py-3 ring-1 ring-border">
      <dt className="flex items-center gap-1 text-meta text-muted-foreground">
        {label}
        {hint && <MetricHint label={label} definition={hint} />}
      </dt>
      <dd className={cn("text-xl font-semibold tabular-nums", tone === "muted" && "text-muted-foreground")}>{value}</dd>
    </div>
  )
}

/** Продажи, предоплаты и деньги за период — как их отдаёт `/payments/metrics/` */
export function SalesFigures({ metrics }: { metrics: SalesMetrics }) {
  const money = (value: string) => formatDecimalMoney(value, metrics.currency)
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Figure label="Продажи" value={formatNumber(metrics.salesCount)} hint={DEFINITIONS.sales} />
      <Figure
        label="Предоплаты"
        value={
          metrics.prepaymentsCount === null || metrics.prepaymentsAmount === null
            ? "нет данных"
            : `${formatNumber(metrics.prepaymentsCount)} · ${money(metrics.prepaymentsAmount)}`
        }
        hint={DEFINITIONS.prepayments}
        tone={metrics.prepaymentsCount === null ? "muted" : "default"}
      />
      <Figure label="Получено" value={money(metrics.received)} hint={DEFINITIONS.received} />
      <Figure label="Оборот" value={money(metrics.turnover)} hint={DEFINITIONS.turnover} />
    </dl>
  )
}

/** Причины светофора backend простыми словами («проколы») */
export const REASONS: Record<string, string> = {
  no_activity: "Нет активности за рабочий день",
  meeting_without_outcome: "Встреча прошла, итог не записан",
  morning_confirmations_below_threshold: "Мало подтверждённых утренних встреч",
  overdue_tasks: "Есть просроченные задачи",
  reschedules_without_date: "Переносы без новой даты",
}
