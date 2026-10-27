import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { DashboardGrid } from "@/features/dashboard"
import { workspaceRepository } from "@/features/workspace"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Главная" }

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const layout = await workspaceRepository.getDashboardLayout(user.role)
  const isTeamView = hasPermission(user.role, "team.view")

  return (
    <div className="space-y-6">
      <PageHeader
        title={isTeamView ? "Результаты отдела продаж" : "Мои результаты"}
        description={`${user.departmentName} · текущий месяц`}
      />
      <DashboardGrid layout={layout} role={user.role} />
    </div>
  )
}
