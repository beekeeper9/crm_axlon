import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { SalesView, SalesViewSkeleton } from "@/features/sales"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Продажи" }

type SalesPageProps = PageProps<"/sales">

async function SalesContent({ searchParams }: Pick<SalesPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  return <SalesView user={user} params={params} />
}

export default function SalesPage({ searchParams }: SalesPageProps) {
  return (
    <div className="space-y-5">
      <PageHeader title="Продажи" description="Сделки по воронкам и этапам" />
      <Suspense fallback={<SalesViewSkeleton />}>
        <SalesContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
