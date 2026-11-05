import Link from "next/link"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { fetchDepartments, fetchPlansProgress, fetchTeamPlanFact, type PlanProgressRow } from "@/features/team-cabinet/api/team-board"
import { tryLoad } from "@/lib/api/load"
import { formatDecimal, formatDecimalMoney, formatNumber } from "@/lib/format"

/**
 * Верх кабинета: план отдела на месяц — в продажах и в деньгах (оборот), как их задал директор.
 * Факт и проценты считает backend. Справа — действие страницы (выгрузка KPI).
 */
export async function DepartmentPlanSection({ plansHref, action }: { plansHref: string | null; action: React.ReactNode }) {
  const result = await tryLoad(async () => {
    const pf = await fetchTeamPlanFact()
    if (!pf.departmentId) return { pf, turnover: null }
    const departments = await fetchDepartments().catch(() => [])
    const plans = await fetchPlansProgress(pf.month, new Map(departments.map((d) => [d.id, d.name])))
    const turnover = plans.find((plan) => plan.scope === "department" && plan.scopeId === pf.departmentId && plan.metric === "monthly_turnover") ?? null
    return { pf, turnover }
  })
  if (!result.ok) return <ApiErrorState error={result.error} bare />
  const { pf, turnover } = result.data
  // Директор без выбранного отдела смотрит всю компанию — у неё свой план на странице «Продажи»
  if (!pf.departmentId) return <div className="flex justify-end">{action}</div>
  const salesPercent = pf.departmentPercent === null ? null : Number(pf.departmentPercent)
  const setPlan = plansHref ? (
    <Link href={plansHref} className="text-primary hover:underline">
      Задать план
    </Link>
  ) : (
    "План отдела задаёт директор."
  )

  return (
    <section aria-labelledby="department-plan" className="space-y-3 rounded-xl px-4 py-3 ring-1 ring-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="department-plan" className="text-base font-semibold">
            План отдела · {pf.month}
          </h2>
          <p className="text-meta text-muted-foreground">
            Осталось дней: {formatNumber(pf.workingDaysLeft)} (календарных — рабочий календарь не настроен)
          </p>
        </div>
        {action}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <PlanLine
          label="Продажи"
          actual={formatNumber(pf.salesActualTotal)}
          target={pf.departmentPlanSales === null ? null : formatDecimal(Number(pf.departmentPlanSales))}
          percent={salesPercent}
          note={
            pf.departmentPlanSales === null
              ? null
              : `Осталось: ${formatDecimal(Number(pf.departmentRemaining ?? 0))} · нужно в день: ${formatDecimal(Number(pf.departmentPerDayNeeded ?? 0))} · сумма личных планов: ${formatDecimal(Number(pf.planSalesTotal))}`
          }
          empty={setPlan}
        />
        <TurnoverLine plan={turnover} empty={setPlan} />
      </div>
    </section>
  )
}

function TurnoverLine({ plan, empty }: { plan: PlanProgressRow | null; empty: React.ReactNode }) {
  const money = (value: string | null) => (value === null ? "—" : plan?.currency ? formatDecimalMoney(value, plan.currency) : formatDecimal(Number(value)))
  return (
    <PlanLine
      label="Оборот"
      actual={plan ? money(plan.actual) : null}
      target={plan ? money(plan.target) : null}
      percent={plan?.percent ? Number(plan.percent) : null}
      note={plan?.remaining ? `Осталось: ${money(plan.remaining)}` : null}
      empty={empty}
    />
  )
}

function PlanLine({
  label,
  actual,
  target,
  percent,
  note,
  empty,
}: {
  label: string
  actual: string | null
  target: string | null
  percent: number | null
  note: string | null
  empty: React.ReactNode
}) {
  const width = Math.min(Math.max(percent ?? 0, 0), 100)
  return (
    <div className="space-y-1.5">
      <p className="text-meta text-muted-foreground">{label}</p>
      {target === null ? (
        <p className="text-sm text-muted-foreground">
          План на месяц не задан{actual !== null && <> · факт: <span className="font-medium text-foreground">{actual}</span></>}. {empty}
        </p>
      ) : (
        <>
          <p className="text-sm">
            <span className="text-2xl font-semibold tabular-nums">{actual}</span>
            <span className="text-muted-foreground"> из {target}</span>
            {percent !== null && <span className="ml-2 font-medium tabular-nums">{formatDecimal(percent)}%</span>}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${label}: выполнение плана`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={width}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
          </div>
          {note && <p className="text-meta text-muted-foreground">{note}</p>}
        </>
      )}
    </div>
  )
}
