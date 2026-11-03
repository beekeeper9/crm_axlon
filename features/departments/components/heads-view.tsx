import Link from "next/link"
import { ArrowUpRight, UsersRound } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { departmentRoute } from "@/config/routes"
import {
  fetchDepartmentPlanFact,
  fetchDepartments,
  fetchDepartmentToday,
  fetchStaff,
  type Department,
  type StaffMember,
} from "@/features/departments/api/department-analytics"
import { REASONS } from "@/features/departments/components/analytics-parts"
import { headOf } from "@/features/departments/components/department-view"
import { LevelDot } from "@/features/team-cabinet/components/cabinet-parts"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { formatDecimal, formatNumber, formatTime, pluralize } from "@/lib/format"

/**
 * «РОПы» для директора: каждый отдел — его РОП, менеджеры, план-факт месяца
 * и «проколы» дня (причины красного и жёлтого статуса по правилам backend).
 */
export async function HeadsView() {
  const loaded = await tryLoad(async () => {
    const auth = await getRenderAuth()
    const [departments, staff] = await Promise.all([fetchDepartments(auth), fetchStaff(auth)])
    return { departments, staff }
  })
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const { departments, staff } = loaded.data
  if (departments.length === 0) {
    return (
      <ListPanel>
        <EmptyState icon={UsersRound} title="Отделов пока нет" description="Создайте отдел продаж на странице «Компания» и назначьте РОПа." />
      </ListPanel>
    )
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {departments.map((department) => (
        <HeadCard key={department.id} department={department} staff={staff} />
      ))}
    </div>
  )
}

async function HeadCard({ department, staff }: { department: Department; staff: readonly StaffMember[] }) {
  const auth = await getRenderAuth()
  const [planFact, today] = await Promise.all([
    tryLoad(() => fetchDepartmentPlanFact(auth, department.id)),
    tryLoad(() => fetchDepartmentToday(auth, department.id)),
  ])
  const head = headOf(staff, department.id)
  const managers = staff.filter((member) => member.isActive && member.departmentId === department.id && member.role !== "head_of_sales")
  const names = new Map(staff.map((member) => [member.userId, member.name]))
  const misses = today.ok ? today.data.managers.filter((row) => row.status !== "green" && !row.onAbsence) : []

  return (
    <section aria-labelledby={`head-${department.id}`} className="space-y-4 rounded-xl p-5 ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 id={`head-${department.id}`} className="text-base font-semibold">
            {head?.name ?? "РОП не назначен"}
          </h2>
          <p className="text-meta text-muted-foreground">
            {department.name} · {formatNumber(managers.length)} {pluralize(managers.length, ["менеджер", "менеджера", "менеджеров"])}
          </p>
        </div>
        <Link href={departmentRoute(department.id)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Отдел
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {planFact.ok ? (
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-meta text-muted-foreground">План продаж · {planFact.data.month}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {Number(planFact.data.planSalesTotal) > 0 ? formatDecimal(Number(planFact.data.planSalesTotal)) : "не задан"}
            </dd>
          </div>
          <div>
            <dt className="text-meta text-muted-foreground">Продажи</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatNumber(planFact.data.salesActualTotal)}</dd>
          </div>
          <div>
            <dt className="text-meta text-muted-foreground">Прогноз</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatDecimal(Number(planFact.data.forecastSalesTotal))}</dd>
          </div>
        </dl>
      ) : (
        <ApiErrorState error={planFact.error} bare />
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          Проколы сегодня{today.ok && <span className="font-normal text-muted-foreground"> · на {formatTime(today.data.asOf)}</span>}
        </h3>
        {!today.ok ? (
          <ApiErrorState error={today.error} bare />
        ) : misses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Проколов нет: все сотрудники отдела в порядке.</p>
        ) : (
          <ul className="space-y-1.5">
            {misses.map((row) => (
              <li key={row.userId} className="flex items-start gap-2 text-sm">
                <LevelDot level={row.status} className="mt-1.5" />
                <span>
                  <span className="font-medium">{names.get(row.userId) ?? row.username}</span>
                  <span className="text-muted-foreground"> — {[...row.redReasons, ...row.yellowReasons].map((code) => REASONS[code] ?? code).join(" · ")}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export function HeadsViewSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-2" aria-busy="true">
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
