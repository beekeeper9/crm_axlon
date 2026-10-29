import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { homeRouteFor } from "@/config/navigation"
import { CreateStaffView, StaffSkeleton } from "@/features/staff"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Новый директор" }

/** Доступ проверяется на сервере; данные и создание аккаунтов backend проверяет ещё раз */
async function Content() {
  const user = await getCurrentUser()
  if (!hasPermission(user.role, "platform.manage")) redirect(homeRouteFor(user.role))
  return <CreateStaffView mode="platform" />
}

export default function Page() {
  return (
    <div className="mx-auto max-w-screen-lg">
      <Suspense fallback={<StaffSkeleton />}>
        <Content />
      </Suspense>
    </div>
  )
}
