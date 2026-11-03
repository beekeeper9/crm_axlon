import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { homeRouteFor } from "@/config/navigation"
import { routes } from "@/config/routes"
import { TeamReportsView } from "@/features/team-cabinet"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Отчёты" }

type ReportsPageProps = PageProps<"/daily-reports">

async function ReportsContent({ searchParams }: Pick<ReportsPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  if (!hasPermission(user.role, "cabinet.view")) redirect(homeRouteFor(user.role))
  return <TeamReportsView params={params} canPickDepartment={hasPermission(user.role, "company.view")} />
}

export default function ReportsPage({ searchParams }: ReportsPageProps) {
  if (isMockDataSource) {
    return (
      <UpcomingSection
        href={routes.dailyReports}
        description="Итоги менеджеров за день, неделю и месяц"
        plannedFeatures={["Отчёты строятся по данным backend — в демо-режиме их нет"]}
      />
    )
  }
  return (
    <div className="mx-auto max-w-screen-xl">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ReportsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
