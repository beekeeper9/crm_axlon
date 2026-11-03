import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Workflow } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { FunnelSettingsSkeleton, FunnelSettingsView } from "@/features/sales/funnel/funnel-settings-view"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Воронка продаж" }

type FunnelPageProps = PageProps<"/sales/funnel">

/** Настраивать воронку могут РОП (свой отдел) и директор; права ещё раз проверяет backend */
async function FunnelContent({ searchParams }: Pick<FunnelPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  if (!hasPermission(user.role, "pipelines.configure")) redirect(routes.sales)
  if (isMockDataSource) {
    return (
      <ListPanel>
        <EmptyState icon={Workflow} title="Воронка настраивается только на сервере" description="В демо-режиме этапы не сохраняются. Запустите интерфейс с NEXT_PUBLIC_DATA_SOURCE=api." />
      </ListPanel>
    )
  }
  return <FunnelSettingsView params={params} isDirector={hasPermission(user.role, "company.view")} />
}

export default function FunnelPage({ searchParams }: FunnelPageProps) {
  return (
    <Suspense fallback={<FunnelSettingsSkeleton />}>
      <FunnelContent searchParams={searchParams} />
    </Suspense>
  )
}
