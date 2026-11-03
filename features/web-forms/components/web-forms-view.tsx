import { Globe } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { DemoNotice } from "@/components/shared/demo-notice"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { fetchWebFormKeys } from "@/features/web-forms/api/web-forms-repository"
import { WebFormKeyCreate } from "@/features/web-forms/components/web-form-key-create"
import { WebFormKeyList } from "@/features/web-forms/components/web-form-key-list"
import { WEB_FORMS_PATH } from "@/features/web-forms/lib/path"
import { API_ADDRESS_PLACEHOLDER } from "@/features/web-forms/lib/snippet"
import { fetchDepartments, fetchOwnDepartment } from "@/features/workspace/api/workspace-repository"
import { tryLoad } from "@/lib/api/load"
import { hasPermission } from "@/lib/permissions/roles"
import { getParam, hrefWithParams, type SearchParamsRecord } from "@/lib/search-params"
import type { CurrentUser } from "@/lib/session/current-user"

const TITLE = "Заявки с сайта"
const DESCRIPTION =
  "Ключ формы связывает форму на сайте компании с отделом: заявки становятся лидами с источником «Сайт» и распределяются по правилам отдела."

/** Ключи форм сайта: директор — любой отдел, РОП — свой */
export async function WebFormsView({ user, params }: { user: CurrentUser; params: SearchParamsRecord }) {
  if (isMockDataSource) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <DemoNotice>Демо-режим: формы сайта работают только при подключённом backend.</DemoNotice>
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
          {isDirector ? "В компании нет отделов — сначала создайте отдел." : "Вы не назначены в отдел — формы сайта может настроить директор."}
        </p>
      </div>
    )
  }

  const loaded = await tryLoad(() => fetchWebFormKeys(departmentId))

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
            href: hrefWithParams(WEB_FORMS_PATH, params, { department: department.id }),
            isActive: department.id === departmentId,
          }))}
        />
      )}
      <WebFormKeyCreate key={departmentId} departmentId={departmentId} />
      <p className="text-meta text-muted-foreground">
        Адрес отправки указан относительно адреса API CRM: в коде формы замените {API_ADDRESS_PLACEHOLDER} на публичный адрес API (его сообщит
        администратор платформы). Местный номер телефона (например, 0700 123 456) переводится в международный формат по стране компании; повторная заявка с тем же контактом в течение 10 минут новый лид не создаёт.
      </p>
      {!loaded.ok ? (
        <ApiErrorState error={loaded.error} />
      ) : loaded.data.length === 0 ? (
        <EmptyState icon={Globe} title="Ключей пока нет" description="Создайте ключ, чтобы получить код формы для сайта." />
      ) : (
        <WebFormKeyList keys={loaded.data} />
      )}
    </div>
  )
}

export function WebFormsViewSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
