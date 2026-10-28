import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { FocusView, FocusViewSkeleton } from "@/features/focus"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Фокус" }

type FocusPageProps = PageProps<"/focus">

async function FocusContent({ searchParams }: Pick<FocusPageProps, "searchParams">) {
  const user = await getCurrentUser()
  const isTeamView = hasPermission(user.role, "team.view")
  const { manager } = await searchParams

  // Менеджер всегда видит только свой фокус; фильтр по менеджерам — для руководителя
  const managerId = isTeamView ? (typeof manager === "string" ? manager : null) : user.id
  return <FocusView isTeamView={isTeamView} managerId={managerId} />
}

export default function FocusPage({ searchParams }: FocusPageProps) {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Фокус"
        description="Лиды и задачи, с которыми стоит работать в первую очередь, чтобы выполнить план"
      />
      {/* Пользователь и фильтр известны только во время запроса — эта часть догружается */}
      <Suspense fallback={<FocusViewSkeleton />}>
        <FocusContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
