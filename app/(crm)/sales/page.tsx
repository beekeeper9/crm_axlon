import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { isMockDataSource } from "@/config/env"
import { SalesOverview } from "@/features/departments"
import { SalesView, SalesViewSkeleton } from "@/features/sales"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Продажи" }

type SalesPageProps = PageProps<"/sales">

async function SalesContent({ searchParams }: Pick<SalesPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  // Директору — цифры компании и отделов вместо воронки с накопленными сделками
  if (!isMockDataSource && hasPermission(user.role, "company.view")) return <SalesOverview params={params} />
  return <SalesView user={user} params={params} />
}

export default function SalesPage({ searchParams }: SalesPageProps) {
  return (
    <div className="space-y-5">
      <PageHeader title="Продажи" description="План, факт, предоплаты и лиды компании и отделов; для менеджеров — сделки по воронкам" />
      <Suspense fallback={<SalesViewSkeleton />}>
        <SalesContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
