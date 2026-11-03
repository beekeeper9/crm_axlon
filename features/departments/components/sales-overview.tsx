import Link from "next/link"
import { ArrowUpRight, Building2 } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { departmentRoute, routes } from "@/config/routes"
import {
  fetchDepartments,
  fetchLeadCounts,
  fetchMonthPlans,
  fetchSalesMetrics,
  fetchStaff,
  plansFor,
  type Department,
  type LeadCounts,
  type PlanProgress,
} from "@/features/departments/api/department-analytics"
import { DEFINITIONS, Figure, PeriodFilter, PlanBar, SalesFigures } from "@/features/departments/components/analytics-parts"
import { DepartmentDetails, headOf } from "@/features/departments/components/department-view"
import { periodFrom, type Period } from "@/features/departments/lib/period"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { formatNumber } from "@/lib/format"
import type { SearchParamsRecord } from "@/lib/search-params"

/**
 * «Продажи» директора — цифры, а не воронка: план компании сверху, затем отделы.
 * Один отдел — его показатели сразу на этой странице; несколько — блоки со ссылками
 * на страницы отделов.
 */
export async function SalesOverview({ params }: { params: SearchParamsRecord }) {
  const period = periodFrom(params)
  const auth = await getRenderAuth()
  const loaded = await tryLoad(async () => {
    const [departments, staff] = await Promise.all([fetchDepartments(auth), fetchStaff(auth)])
    return { departments, staff }
  })
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const { departments, staff } = loaded.data
  const [plans, companyMetrics, companyCounts, departmentCounts] = await Promise.all([
    tryLoad(() => fetchMonthPlans(auth, period.month)),
    tryLoad(() => fetchSalesMetrics(auth, period.from, period.to, null)),
    tryLoad(() => fetchLeadCounts(auth, period.from, period.to, "company")),
    tryLoad(() => fetchLeadCounts(auth, period.from, period.to, "department")),
  ])
  const companyPlans = plans.ok ? plansFor(plans.data, "company", null) : []
  const companyLeads = companyCounts.ok ? companyCounts.data.get(null) : undefined

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-meta text-muted-foreground">Продажа — каждая сделка с первой оплатой. Все числа считает сервер.</p>
        <PeriodFilter period={period} params={params} action={routes.sales} />
      </div>

      <section aria-labelledby="company-plan" className="space-y-4 rounded-xl p-5 ring-1 ring-border">
        <h2 id="company-plan" className="text-lg font-bold">
          План продаж компании · {period.month}
        </h2>
        {!plans.ok ? (
          <ApiErrorState error={plans.error} bare />
        ) : companyPlans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            План компании на этот месяц не задан — задайте его в разделе{" "}
            <Link href={`${routes.team}?tab=plans`} className="text-primary hover:underline">
              «Планы»
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {companyPlans.map((plan) => (
              <PlanBar key={plan.id} plan={plan} emphasis />
            ))}
          </div>
        )}
        {companyMetrics.ok ? <SalesFigures metrics={companyMetrics.data} /> : <ApiErrorState error={companyMetrics.error} bare />}
        {companyCounts.ok ? (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="Лидов в базе" value={formatNumber(companyLeads?.leadsTotal ?? 0)} hint={DEFINITIONS.leadsTotal} />
            <Figure label="Новых лидов за период" value={formatNumber(companyLeads?.leadsNew ?? 0)} hint={DEFINITIONS.leadsNew} />
          </dl>
        ) : (
          <ApiErrorState error={companyCounts.error} bare />
        )}
      </section>

      {departments.length === 0 ? (
        <ListPanel>
          <EmptyState icon={Building2} title="Отделов продаж пока нет" description="Создайте отдел на странице «Компания» и назначьте ему РОПа." />
        </ListPanel>
      ) : departments.length === 1 ? (
        <section aria-labelledby="single-department" className="space-y-3">
          <h2 id="single-department" className="text-lg font-semibold">
            {departments[0].name}
          </h2>
          <DepartmentDetails department={departments[0]} staff={staff} period={period} />
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {departments.map((department) => (
            <DepartmentBlock
              key={department.id}
              department={department}
              head={headOf(staff, department.id)?.name ?? null}
              plans={plans.ok ? plansFor(plans.data, "department", department.id) : []}
              leads={departmentCounts.ok ? departmentCounts.data.get(department.id) : undefined}
              period={period}
            />
          ))}
        </div>
      )}
    </div>
  )
}

async function DepartmentBlock({
  department,
  head,
  plans,
  leads,
  period,
}: {
  department: Department
  head: string | null
  plans: readonly PlanProgress[]
  leads: LeadCounts | undefined
  period: Period
}) {
  const metrics = await tryLoad(async () => fetchSalesMetrics(await getRenderAuth(), period.from, period.to, department.id))
  return (
    <section aria-labelledby={`department-${department.id}`} className="space-y-4 rounded-xl p-5 ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`department-${department.id}`} className="text-base font-semibold">
            <Link href={departmentRoute(department.id)} className="hover:text-primary hover:underline">
              {department.name}
            </Link>
          </h2>
          <p className="text-meta text-muted-foreground">РОП: {head ?? "не назначен"}</p>
        </div>
        <Link href={departmentRoute(department.id)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Подробнее
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">План отдела на месяц не задан.</p>
      ) : (
        plans.map((plan) => <PlanBar key={plan.id} plan={plan} />)
      )}
      {metrics.ok ? <SalesFigures metrics={metrics.data} /> : <ApiErrorState error={metrics.error} bare />}
      <dl className="grid gap-3 sm:grid-cols-2">
        <Figure label="Лидов в базе" value={formatNumber(leads?.leadsTotal ?? 0)} hint={DEFINITIONS.leadsTotal} />
        <Figure label="Новых лидов за период" value={formatNumber(leads?.leadsNew ?? 0)} hint={DEFINITIONS.leadsNew} />
      </dl>
    </section>
  )
}
