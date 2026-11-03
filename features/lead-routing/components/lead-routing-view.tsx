import { ApiErrorState } from "@/components/shared/api-error-state"
import { DemoNotice } from "@/components/shared/demo-notice"
import { PageHeader } from "@/components/shared/page-header"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { fetchLeadRouting } from "@/features/lead-routing/api/lead-routing-repository"
import { LeadRoutingForm } from "@/features/lead-routing/components/lead-routing-form"
import { LEAD_ROUTING_PATH } from "@/features/lead-routing/lib/path"
import { fetchDepartments, fetchOwnDepartment } from "@/features/workspace/api/workspace-repository"
import { tryLoad } from "@/lib/api/load"
import { formatDateTime } from "@/lib/format"
import { hasPermission } from "@/lib/permissions/roles"
import { getParam, hrefWithParams, type SearchParamsRecord } from "@/lib/search-params"
import type { CurrentUser } from "@/lib/session/current-user"

const TITLE = "Распределение лидов"
const DESCRIPTION = "Новые лиды по очереди уходят менеджерам отдела, которые на смене и не в отсутствии."

/** Автораспределение лидов: директор — любой отдел, РОП — свой */
export async function LeadRoutingView({ user, params }: { user: CurrentUser; params: SearchParamsRecord }) {
  if (isMockDataSource) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <DemoNotice>Демо-режим: распределение настраивается только при подключённом backend.</DemoNotice>
      </div>
    )
  }

  const isDirector = hasPermission(user.role, "company.view")
  const scopes = await tryLoad(async () => {
    if (isDirector) return { departments: await fetchDepartments(), own: null }
    return { departments: [], own: await fetchOwnDepartment() }
  })
  if (!scopes.ok) return <ApiErrorState error={scopes.error} />
  const { departments, own } = scopes.data

  const requested = getParam(params, "department")
  const departmentId = isDirector ? (departments.find((d) => d.id === requested) ?? departments[0])?.id ?? null : (own?.id ?? null)

  if (!departmentId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <p className="text-sm text-muted-foreground">
          {isDirector ? "В компании нет отделов — сначала создайте отдел." : "Вы не назначены в отдел — настроить распределение может директор."}
        </p>
      </div>
    )
  }

  const loaded = await tryLoad(() => fetchLeadRouting(departmentId))

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={TITLE} description={DESCRIPTION} />
      {isDirector && departments.length > 1 && (
        <SegmentedLinks
          label="Отдел"
          variant="pill"
          items={departments.map((department) => ({
            key: department.id,
            label: department.name,
            href: hrefWithParams(LEAD_ROUTING_PATH, params, { department: department.id }),
            isActive: department.id === departmentId,
          }))}
        />
      )}
      {!loaded.ok ? (
        <ApiErrorState error={loaded.error} />
      ) : (
        <>
          <p className="text-meta text-muted-foreground">
            {loaded.data.isDefault || !loaded.data.updatedAt ? "Не настроено — распределение выключено" : `Изменено ${formatDateTime(loaded.data.updatedAt)}`}
          </p>
          <LeadRoutingForm key={departmentId} departmentId={departmentId} initial={loaded.data} canChooseIntake={isDirector} />
        </>
      )}
    </div>
  )
}

export function LeadRoutingViewSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  )
}
