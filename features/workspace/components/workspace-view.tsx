import Link from "next/link"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { DemoNotice } from "@/components/shared/demo-notice"
import { PageHeader } from "@/components/shared/page-header"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { fetchDepartments, fetchLayout, fetchOwnDepartment } from "@/features/workspace/api/workspace-repository"
import { LayoutEditor } from "@/features/workspace/components/layout-editor"
import { tryLoad } from "@/lib/api/load"
import { formatDateTime } from "@/lib/format"
import { hasPermission } from "@/lib/permissions/roles"
import { getParam, hrefWithParams, type SearchParamsRecord } from "@/lib/search-params"
import type { CurrentUser } from "@/lib/session/current-user"

const COMPANY = "company"

/**
 * «Рабочее пространство»: руководитель решает, какие блоки «Моего дня» видят менеджеры и в каком
 * порядке. Директор — для компании и любого отдела, РОП — для своего отдела.
 */
export async function WorkspaceView({ user, params }: { user: CurrentUser; params: SearchParamsRecord }) {
  const isDirector = hasPermission(user.role, "company.view")
  const scopes = await tryLoad(async () => {
    if (isDirector) return { departments: await fetchDepartments(), own: null }
    return { departments: [], own: await fetchOwnDepartment() }
  })
  if (!scopes.ok) return <ApiErrorState error={scopes.error} />
  const { departments, own } = scopes.data

  if (!isDirector && !own && !isMockDataSource) {
    return (
      <div className="space-y-4">
        <PageHeader title="Рабочее пространство" description="Раскладка «Моего дня» для вашего отдела" />
        <p className="text-sm text-muted-foreground">Вы не назначены в отдел — настроить раскладку может директор.</p>
      </div>
    )
  }

  const requested = getParam(params, "scope")
  const departmentId = isDirector ? (departments.some((d) => d.id === requested) ? requested : null) : (own?.id ?? null)
  const loaded = await tryLoad(() => fetchLayout(departmentId))
  const scopeName = departmentId ? (departments.find((d) => d.id === departmentId)?.name ?? own?.name ?? "Отдел") : "Вся компания"

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Рабочее пространство"
        description="Какие блоки «Моего дня» видят менеджеры и в каком порядке. Скрытый блок не закрывает доступ к данным — только убирает его с экрана."
      />
      {isDirector && departments.length > 0 && (
        <SegmentedLinks
          label="Чью раскладку настраиваем"
          variant="pill"
          items={[
            { key: COMPANY, label: "Вся компания", href: hrefWithParams(routes.workspace, params, { scope: null }), isActive: departmentId === null },
            ...departments.map((department) => ({
              key: department.id,
              label: department.name,
              href: hrefWithParams(routes.workspace, params, { scope: department.id }),
              isActive: department.id === departmentId,
            })),
          ]}
        />
      )}
      {!loaded.ok ? (
        <ApiErrorState error={loaded.error} />
      ) : (
        <>
          <p className="text-meta text-muted-foreground">
            {scopeName} ·{" "}
            {loaded.data.isDefault || !loaded.data.updatedAt
              ? departmentId
                ? "своей раскладки нет — действует раскладка компании или по умолчанию"
                : "раскладка по умолчанию"
              : `изменено ${formatDateTime(loaded.data.updatedAt)}`}
            {" · "}
            <Link href={routes.myDay} className="text-primary hover:underline">
              как видит менеджер
            </Link>
          </p>
          <LayoutEditor key={departmentId ?? COMPANY} departmentId={departmentId} initial={loaded.data.blocks} />
          {isMockDataSource && <DemoNotice>Демо-режим: раскладка не сохраняется на сервере.</DemoNotice>}
        </>
      )}
    </div>
  )
}

export function WorkspaceViewSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  )
}
