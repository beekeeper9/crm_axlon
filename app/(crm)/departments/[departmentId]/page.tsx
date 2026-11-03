import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Building2 } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { isMockDataSource } from "@/config/env"
import { homeRouteFor } from "@/config/navigation"
import { DepartmentView, DepartmentViewSkeleton } from "@/features/departments"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Отдел продаж" }

type DepartmentPageProps = PageProps<"/departments/[departmentId]">

/**
 * Директор открывает любой отдел, РОП — свой (чужой отдел backend не отдаёт: 403).
 * Менеджеру страница недоступна — ведём на его стартовую.
 */
async function DepartmentContent({ params, searchParams }: DepartmentPageProps) {
  const [user, { departmentId }, query] = await Promise.all([getCurrentUser(), params, searchParams])
  if (!hasPermission(user.role, "cabinet.view")) redirect(homeRouteFor(user.role))
  if (isMockDataSource) {
    return (
      <ListPanel>
        <EmptyState icon={Building2} title="Аналитика отделов — только с реальными данными" description="В демо-режиме показатели отделов не рассчитываются." />
      </ListPanel>
    )
  }
  return <DepartmentView departmentId={departmentId} params={query} />
}

export default function DepartmentPage(props: DepartmentPageProps) {
  return (
    <div className="mx-auto max-w-screen-xl">
      <Suspense fallback={<DepartmentViewSkeleton />}>
        <DepartmentContent {...props} />
      </Suspense>
    </div>
  )
}
