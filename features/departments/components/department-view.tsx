import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { ListPanel } from "@/components/shared/list-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { routes } from "@/config/routes"
import {
  fetchDepartmentPlanFact,
  fetchDepartments,
  fetchDepartmentToday,
  fetchLeadCounts,
  fetchMonthPlans,
  fetchSalesMetrics,
  fetchStaff,
  plansFor,
  type Department,
  type StaffMember,
} from "@/features/departments/api/department-analytics"
import { DEFINITIONS, Figure, PeriodFilter, PlanBar, REASONS, SalesFigures } from "@/features/departments/components/analytics-parts"
import { periodFrom, type Period } from "@/features/departments/lib/period"
import { CabinetSection, LevelDot } from "@/features/team-cabinet/components/cabinet-parts"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { formatDecimal, formatDecimalMoney, formatNumber, formatTime } from "@/lib/format"
import type { SearchParamsRecord } from "@/lib/search-params"

/** Страница отдела продаж: РОП и менеджеры, план и факт, продажи, предоплаты и лиды за период */
export async function DepartmentView({ departmentId, params }: { departmentId: string; params: SearchParamsRecord }) {
  const loaded = await tryLoad(async () => {
    const auth = await getRenderAuth()
    const [departments, staff] = await Promise.all([fetchDepartments(auth), fetchStaff(auth)])
    return { departments, staff }
  })
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const department = loaded.data.departments.find((item) => item.id === departmentId)
  if (!department) notFound()
  const period = periodFrom(params)
  const head = headOf(loaded.data.staff, department.id)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Link href={routes.company} className="inline-flex items-center gap-1 text-meta text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" aria-hidden />
            Компания
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">{department.name}</h1>
          <p className="text-meta text-muted-foreground">РОП: {head?.name ?? "не назначен"}</p>
        </div>
        <PeriodFilter period={period} params={params} action={`${routes.departments}/${encodeURIComponent(department.id)}`} />
      </header>
      <DepartmentDetails department={department} staff={loaded.data.staff} period={period} />
    </div>
  )
}

export function headOf(staff: readonly StaffMember[], departmentId: string): StaffMember | undefined {
  return staff.find((member) => member.isActive && member.role === "head_of_sales" && member.departmentId === departmentId)
}

/** Показатели отдела за период — на странице отдела и на «Продажах», если отдел один */
export async function DepartmentDetails({ department, staff, period }: { department: Department; staff: readonly StaffMember[]; period: Period }) {
  const auth = await getRenderAuth()
  const [plans, metrics, counts, planFact, today] = await Promise.all([
    tryLoad(() => fetchMonthPlans(auth, period.month)),
    tryLoad(() => fetchSalesMetrics(auth, period.from, period.to, department.id)),
    tryLoad(() => fetchLeadCounts(auth, period.from, period.to, "department")),
    tryLoad(() => fetchDepartmentPlanFact(auth, department.id)),
    tryLoad(() => fetchDepartmentToday(auth, department.id)),
  ])
  const departmentPlans = plans.ok ? plansFor(plans.data, "department", department.id) : []
  const names = new Map(staff.map((member) => [member.userId, member.name]))
  const statusOf = new Map(today.ok ? today.data.managers.map((row) => [row.userId, row]) : [])
  const leads = counts.ok ? counts.data.get(department.id) : undefined

  return (
    <div className="space-y-6">
      <CabinetSection id={`plan-${department.id}`} title={`План отдела · ${period.month}`} description="План задаёт директор; факт и процент считает сервер.">
        {!plans.ok ? (
          <ApiErrorState error={plans.error} bare />
        ) : departmentPlans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            План отдела на этот месяц не задан. Задать его можно в разделе{" "}
            <Link href={`${routes.team}?tab=plans`} className="text-primary hover:underline">
              «Планы»
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {departmentPlans.map((plan) => (
              <div key={plan.id} className="rounded-xl p-4 ring-1 ring-border">
                <PlanBar plan={plan} />
              </div>
            ))}
          </div>
        )}
      </CabinetSection>

      <CabinetSection id={`sales-${department.id}`} title="Продажи и деньги за период" description={`С ${period.from} по ${period.to}`}>
        {metrics.ok ? <SalesFigures metrics={metrics.data} /> : <ApiErrorState error={metrics.error} bare />}
      </CabinetSection>

      <CabinetSection id={`leads-${department.id}`} title="Лиды и клиенты">
        {!counts.ok ? (
          <ApiErrorState error={counts.error} bare />
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="Лидов в базе" value={formatNumber(leads?.leadsTotal ?? 0)} hint={DEFINITIONS.leadsTotal} />
            <Figure label="Новых лидов за период" value={formatNumber(leads?.leadsNew ?? 0)} hint={DEFINITIONS.leadsNew} />
            <Figure label="Клиентов в базе" value={formatNumber(leads?.customersTotal ?? 0)} />
            <Figure label="Новых клиентов за период" value={formatNumber(leads?.customersNew ?? 0)} />
          </dl>
        )}
      </CabinetSection>

      <CabinetSection
        id={`team-${department.id}`}
        title="РОП и менеджеры"
        description={
          planFact.ok
            ? `План продаж за ${planFact.data.month}: прошло дней ${planFact.data.workingDaysElapsed} из ${planFact.data.workingDaysTotal}. Прогноз — линейный по темпу.`
            : undefined
        }
        action={today.ok ? <span className="text-meta text-muted-foreground">Статус дня на {formatTime(today.data.asOf)}</span> : undefined}
      >
        {!planFact.ok ? (
          <ApiErrorState error={planFact.error} bare />
        ) : planFact.data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">В отделе пока нет сотрудников.</p>
        ) : (
          <ListPanel>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="border-b">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Сотрудник</th>
                    <th className="px-3 py-2 font-medium">План</th>
                    <th className="px-3 py-2 font-medium">Продажи</th>
                    <th className="px-3 py-2 font-medium">Осталось</th>
                    <th className="px-3 py-2 font-medium">Прогноз</th>
                    <th className="px-3 py-2 font-medium">Получено</th>
                    <th className="px-3 py-2 font-medium">Сегодня</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {planFact.data.rows
                    .toSorted((a, b) => Number(b.productRole === "head_of_sales") - Number(a.productRole === "head_of_sales"))
                    .map((row) => {
                      const day = statusOf.get(row.userId)
                      const reasons = day ? [...day.redReasons, ...day.yellowReasons].map((code) => REASONS[code] ?? code) : []
                      return (
                        <tr key={row.userId} className="align-top">
                          <td className="px-3 py-2">
                            <span className="font-medium">{names.get(row.userId) ?? row.username}</span>
                            {row.productRole === "head_of_sales" && <span className="ml-1.5 text-xs text-muted-foreground">РОП</span>}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{Number(row.planSales) > 0 ? formatDecimal(Number(row.planSales)) : <span className="text-muted-foreground">не задан</span>}</td>
                          <td className="px-3 py-2 tabular-nums">{formatNumber(row.salesActual)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatDecimal(Number(row.remainingSales))}</td>
                          <td className="px-3 py-2 tabular-nums">{formatDecimal(Number(row.forecastSales))}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {metrics.ok ? formatDecimalMoney(row.receivedActual, metrics.data.currency) : formatDecimal(Number(row.receivedActual))}
                          </td>
                          <td className="px-3 py-2">
                            {day ? (
                              <span className="flex items-start gap-2">
                                <LevelDot level={day.status} className="mt-1" />
                                <span className="text-xs text-muted-foreground">{day.onAbsence ? "Отсутствует по графику" : reasons.join(" · ") || "В порядке"}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </ListPanel>
        )}
        {!today.ok && <ApiErrorState error={today.error} bare />}
      </CabinetSection>
    </div>
  )
}

export function DepartmentViewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
