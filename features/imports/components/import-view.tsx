import { FileSpreadsheet } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { fetchStaff } from "@/features/departments/api/department-analytics"
import { fetchRecentImports } from "@/features/imports/api/imports-repository"
import { ImportWizard, type ImportOwnerOption } from "@/features/imports/components/import-wizard"
import { IMPORT_ENTITY_LABELS, type ImportJob } from "@/features/imports/schemas"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { formatDateTime, formatNumber } from "@/lib/format"
import { hasPermission } from "@/lib/permissions/roles"
import type { CurrentUser } from "@/lib/session/current-user"

/** Импорт лидов и клиентов из CSV и журнал последних загрузок компании */
export async function ImportView({ user }: { user: CurrentUser }) {
  if (isMockDataSource) {
    return (
      <ListPanel>
        <EmptyState icon={FileSpreadsheet} title="Загрузка файлов работает только с сервером" description="В демо-режиме проверять дубли и создавать записи негде." />
      </ListPanel>
    )
  }
  const auth = await getRenderAuth()
  // Назначить другого ответственного могут директор и РОП; область сотрудников (РОП — свой отдел) отдаёт backend
  const canAssign = hasPermission(user.role, "staff.manage")
  const [jobs, staff] = await Promise.all([
    tryLoad(() => fetchRecentImports(auth)),
    canAssign ? tryLoad(() => fetchStaff(auth)) : Promise.resolve(null),
  ])
  const owners: ImportOwnerOption[] | null =
    staff && staff.ok
      ? staff.data.filter((member) => member.isActive && member.userId !== user.id).map(({ userId, name }) => ({ userId, name }))
      : null
  const nameOf = new Map((owners ?? []).map((owner) => [owner.userId, owner.name]))
  nameOf.set(user.id, user.fullName)

  return (
    <div className="space-y-6">
      <ImportWizard owners={owners} />
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Последние загрузки</h2>
        {jobs.ok ? <RecentImports jobs={jobs.data} nameOf={nameOf} /> : <ApiErrorState error={jobs.error} />}
      </section>
    </div>
  )
}

function RecentImports({ jobs, nameOf }: { jobs: readonly ImportJob[]; nameOf: ReadonlyMap<string, string> }) {
  if (jobs.length === 0) {
    return (
      <ListPanel>
        <EmptyState icon={FileSpreadsheet} title="Загрузок ещё не было" />
      </ListPanel>
    )
  }
  return (
    <ListPanel>
      <ul className="divide-y">
        {jobs.map((job) => (
          <li key={job.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
            <span className="font-medium">{job.filename}</span>
            <span className="text-muted-foreground">{IMPORT_ENTITY_LABELS[job.entity]}</span>
            <span>
              создано {formatNumber(job.created)} из {formatNumber(job.total)}
              {job.duplicates > 0 && `, дублей ${formatNumber(job.duplicates)}`}
              {job.invalid + job.failed > 0 && `, с ошибками ${formatNumber(job.invalid + job.failed)}`}
            </span>
            <span className="text-meta ml-auto text-muted-foreground">
              {nameOf.get(job.createdBy) ?? "сотрудник"} · {formatDateTime(job.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </ListPanel>
  )
}

export function ImportViewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  )
}
