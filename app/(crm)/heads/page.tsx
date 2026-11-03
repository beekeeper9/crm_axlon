import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { UsersRound } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { PageHeader } from "@/components/shared/page-header"
import { isMockDataSource } from "@/config/env"
import { homeRouteFor } from "@/config/navigation"
import { HeadsView, HeadsViewSkeleton } from "@/features/departments"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "РОПы" }

/** Только директор: руководители отделов, их команды, план-факт и проколы */
async function HeadsContent() {
  const user = await getCurrentUser()
  if (!hasPermission(user.role, "company.view")) redirect(homeRouteFor(user.role))
  if (isMockDataSource) {
    return (
      <ListPanel>
        <EmptyState icon={UsersRound} title="Раздел работает с реальными данными" description="В демо-режиме показатели РОПов не рассчитываются." />
      </ListPanel>
    )
  }
  return <HeadsView />
}

export default function HeadsPage() {
  return (
    <div className="mx-auto max-w-screen-xl space-y-5">
      <PageHeader title="РОПы" description="Руководители отделов продаж: команды, план и факт, проколы дня" />
      <Suspense fallback={<HeadsViewSkeleton />}>
        <HeadsContent />
      </Suspense>
    </div>
  )
}
