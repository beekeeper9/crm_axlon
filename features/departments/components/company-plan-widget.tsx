import Link from "next/link"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { departmentRoute } from "@/config/routes"
import {
  fetchCompanyCurrency,
  fetchDepartments,
  fetchMonthPlans,
  plansFor,
  type PlanProgress,
} from "@/features/departments/api/department-analytics"
import { PlanBar } from "@/features/departments/components/analytics-parts"
import { PlanDistribution } from "@/features/departments/components/plan-distribution"
import { PlanEditor } from "@/features/departments/components/plan-editor"
import { distributionStatus } from "@/features/departments/lib/plan-distribution"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { nowIso } from "@/lib/clock"
import { companyDateOf } from "@/lib/datetime"
import { formatDecimal, formatDecimalMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

const target = (plans: readonly PlanProgress[], metric: string) => plans.find((plan) => plan.metric === metric) ?? null

/**
 * План компании на месяц (продажи и деньги с валютой): задать, изменить и распределить
 * между отделами. Только для директора: страница «Компания» и его «Продажи».
 * month — ГГГГ-ММ, по умолчанию текущий месяц компании.
 */
export async function CompanyPlanWidget({ month = companyDateOf(nowIso()).slice(0, 7) }: { month?: string }) {
  const loaded = await tryLoad(async () => {
    const auth = await getRenderAuth()
    const [plans, departments, companyCurrency] = await Promise.all([fetchMonthPlans(auth, month), fetchDepartments(auth), fetchCompanyCurrency(auth)])
    return { plans, departments, companyCurrency }
  })
  if (!loaded.ok) return <ApiErrorState error={loaded.error} bare />
  const { plans, departments, companyCurrency } = loaded.data
  const company = plansFor(plans, "company", null)
  const sales = target(company, "monthly_sales")
  const money = target(company, "monthly_turnover")
  const rows = departments.map((department) => {
    const own = plansFor(plans, "department", department.id)
    return {
      departmentId: department.id,
      name: department.name,
      sales: target(own, "monthly_sales")?.target ?? null,
      money: target(own, "monthly_turnover")?.target ?? null,
      moneyCurrency: target(own, "monthly_turnover")?.currency ?? null,
    }
  })
  // Деньги складываются только в одной валюте: план отдела в другой валюте в сумму не входит
  const mismatched = money?.currency ? rows.filter((row) => row.money !== null && row.moneyCurrency !== money.currency) : []
  const checks = [
    { title: "Продажи", plan: sales, parts: rows.map((row) => row.sales ?? "0"), format: (value: string) => formatDecimal(Number(value)) },
    {
      title: "Деньги",
      plan: money,
      parts: rows.map((row) => (row.money !== null && row.moneyCurrency === money?.currency ? row.money : "0")),
      format: (value: string) => (money?.currency ? formatDecimalMoney(value, money.currency) : formatDecimal(Number(value))),
    },
  ].filter((check) => check.plan !== null)

  return (
    <section aria-labelledby="company-plan-widget" className="space-y-4 rounded-xl p-5 ring-1 ring-border">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 id="company-plan-widget" className="text-lg font-bold">
            План продаж компании · {month}
          </h2>
          <p className="text-meta text-muted-foreground">Факт и процент выполнения считает сервер. Продажа — каждая сделка с первой оплатой.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PlanEditor
            scope="company"
            scopeId={null}
            month={month}
            title="компании"
            salesTarget={sales?.target ?? null}
            moneyTarget={money?.target ?? null}
            currency={money?.currency ?? null}
            companyCurrency={companyCurrency}
          />
          <PlanDistribution month={month} companySales={sales?.target ?? null} companyMoney={money?.target ?? null} currency={money?.currency ?? null} rows={rows} />
        </div>
      </div>

      {company.length === 0 ? (
        <p className="text-sm text-muted-foreground">План компании на этот месяц не задан — нажмите «Задать план».</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {company.map((plan) => (
            <PlanBar key={plan.id} plan={plan} emphasis />
          ))}
        </div>
      )}

      {company.length > 0 && departments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Распределение по отделам</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {rows.map((row) => (
              <li key={row.departmentId} className="rounded-lg px-3 py-2 text-sm ring-1 ring-border">
                <Link href={departmentRoute(row.departmentId)} className="font-medium hover:text-primary hover:underline">
                  {row.name}
                </Link>
                <p className="text-meta text-muted-foreground tabular-nums">
                  {sales && `продаж: ${row.sales === null ? "не задано" : formatDecimal(Number(row.sales))}`}
                  {sales && money && " · "}
                  {money &&
                    `денег: ${row.money === null ? "не задано" : formatDecimalMoney(row.money, row.moneyCurrency ?? money.currency ?? companyCurrency)}`}
                </p>
              </li>
            ))}
          </ul>
          {mismatched.length > 0 && (
            <p className="text-meta text-warning">
              В другой валюте и не учтены в распределении: {mismatched.map((row) => row.name).join(", ")}. Нажмите «Распределить план» — планы
              отделов перейдут в валюту плана компании.
            </p>
          )}
          {checks.map((check) => {
            const status = distributionStatus(check.plan?.target ?? "0", check.parts)
            return (
              <p key={check.title} className={cn("text-meta", status.isExact ? "text-muted-foreground" : "text-warning")}>
                {check.title}: распределено {check.format(status.distributed)} из {check.format(check.plan?.target ?? "0")}
                {status.isExact
                  ? " — полностью"
                  : Number(status.remaining) > 0
                    ? ` — осталось распределить ${check.format(status.remaining)}`
                    : ` — отделам выдано больше плана на ${check.format(String(-Number(status.remaining)))}`}
                {!status.isExact && ". Нажмите «Распределить план», чтобы пересмотреть доли."}
              </p>
            )
          })}
        </div>
      )}
    </section>
  )
}
