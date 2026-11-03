"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Split } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { distributePlanAction } from "@/features/departments/actions"
import { distributionStatus, parseTarget, type PlanMetricKey } from "@/features/departments/lib/plan-distribution"
import { formatDecimal, formatDecimalMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

export type DistributionRow = {
  departmentId: string
  name: string
  /** Текущие планы отдела на месяц; null — ещё не задан */
  sales: string | null
  money: string | null
}

type PlanDistributionProps = {
  month: string
  /** План компании по каждой метрике; null — не задан, колонку не распределяем */
  companySales: string | null
  companyMoney: string | null
  currency: string | null
  rows: readonly DistributionRow[]
}

const clean = (value: string | null) => (value === null ? "" : value.replace(/\.00$/, ""))
/** Пустое поле — 0; нечисловое — не участвует в сумме (форма покажет ошибку при сохранении) */
const asPart = (value: string) => parseTarget(value === "" ? "0" : value) ?? "0"

/**
 * «Распределить план»: директор сам задаёт долю каждого отдела, форма показывает,
 * сколько распределено и сколько осталось. Планы отделов меняются только по кнопке
 * «Сохранить распределение» — backend ещё раз проверяет, что сумма равна плану компании.
 */
export function PlanDistribution({ month, companySales, companyMoney, currency, rows }: PlanDistributionProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const initial = () => Object.fromEntries(rows.map((row) => [row.departmentId, { sales: clean(row.sales), money: clean(row.money) }]))
  const [values, setValues] = useState<Record<string, { sales: string; money: string }>>(initial)

  const metrics: { key: PlanMetricKey; field: "sales" | "money"; title: string; company: string | null; format: (value: string) => string }[] = [
    { key: "monthly_sales", field: "sales", title: "Продажи", company: companySales, format: (value) => formatDecimal(Number(value)) },
    {
      key: "monthly_turnover",
      field: "money",
      title: `Деньги${currency ? `, ${currency}` : ""}`,
      company: companyMoney,
      format: (value) => (currency ? formatDecimalMoney(value, currency) : formatDecimal(Number(value))),
    },
  ]
  const active = metrics.filter((metric) => metric.company !== null)
  const statuses = new Map(
    active.map((metric) => [metric.key, distributionStatus(metric.company ?? "0", rows.map((row) => asPart(values[row.departmentId]?.[metric.field] ?? "")))])
  )
  const canSave = active.length > 0 && active.every((metric) => statuses.get(metric.key)?.isExact)

  function set(departmentId: string, field: "sales" | "money", value: string) {
    setValues((current) => ({ ...current, [departmentId]: { ...(current[departmentId] ?? { sales: "", money: "" }), [field]: value } }))
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={active.length === 0 || rows.length === 0}
        title={active.length === 0 ? "Сначала задайте план компании" : rows.length === 0 ? "Сначала создайте отдел" : undefined}
        onClick={() => {
          setValues(initial())
          setFailure(null)
          setOpen(true)
        }}
      >
        <Split data-icon="inline-start" aria-hidden />
        Распределить план
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form
            className="grid gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              startTransition(async () => {
                for (const metric of active) {
                  const error = await distributePlanAction({
                    period: month,
                    metric: metric.key,
                    parts: rows.map((row) => ({ departmentId: row.departmentId, target: values[row.departmentId]?.[metric.field] ?? "" })),
                  })
                  if (error) {
                    setFailure(error)
                    return
                  }
                }
                setOpen(false)
                router.refresh()
              })
            }}
          >
            <DialogHeader>
              <DialogTitle>Распределить план компании · {month}</DialogTitle>
              <DialogDescription>Укажите долю каждого отдела. Сохранить можно, когда распределён весь план — без остатка.</DialogDescription>
            </DialogHeader>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Отдел</th>
                    {active.map((metric) => (
                      <th key={metric.key} className="py-2 pr-3 font-medium">
                        {metric.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.departmentId}>
                      <td className="min-w-[9rem] py-1.5 pr-3 font-medium">{row.name}</td>
                      {active.map((metric) => (
                        <td key={metric.key} className="py-1.5 pr-3">
                          <Input
                            value={values[row.departmentId]?.[metric.field] ?? ""}
                            onChange={(e) => set(row.departmentId, metric.field, e.target.value)}
                            inputMode="decimal"
                            placeholder="0"
                            aria-label={`${metric.title}: ${row.name}`}
                            className="h-8"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="grid gap-2 sm:grid-cols-2">
              {active.map((metric) => {
                const status = statuses.get(metric.key)
                const remaining = Number(status?.remaining ?? 0)
                return (
                  <div key={metric.key} className={cn("rounded-lg px-3 py-2 text-sm ring-1", status?.isExact ? "ring-success/40" : "ring-warning/50")}>
                    <dt className="font-medium">{metric.title}</dt>
                    <dd className="text-meta text-muted-foreground tabular-nums">
                      Распределено {metric.format(status?.distributed ?? "0")} из {metric.format(metric.company ?? "0")}
                      {" · "}
                      {remaining === 0
                        ? "распределено полностью"
                        : remaining > 0
                          ? `осталось ${metric.format(status?.remaining ?? "0")}`
                          : `больше плана на ${metric.format(String(-remaining))}`}
                    </dd>
                  </div>
                )
              })}
            </dl>

            {failure && (
              <p role="alert" className="text-sm text-destructive">
                {failure}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={!canSave || isPending}>
                {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
                Сохранить распределение
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
