import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { homeRouteFor } from "@/config/navigation"
import { StaffListView, StaffSkeleton } from "@/features/staff"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Сотрудники" }

/** Доступ проверяется на сервере; данные и создание аккаунтов backend проверяет ещё раз */
async function Content({ searchParams }: Pick<PageProps<"/staff">, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  if (!hasPermission(user.role, "staff.manage")) redirect(homeRouteFor(user.role))
  return <StaffListView
      canHire={hasPermission(user.role, "staff.hire")}
      canDecide={hasPermission(user.role, "staff.approve")}
      currentUserId={user.id}
      currentLogin={user.login}
      params={params}
    />
}

export default function Page({ searchParams }: PageProps<"/staff">) {
  return (
    <div className="mx-auto max-w-screen-lg">
      <Suspense fallback={<StaffSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
