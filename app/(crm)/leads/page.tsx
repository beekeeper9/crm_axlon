import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { LeadsListView, SalesViewSkeleton } from "@/features/sales"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Список" }

type LeadsPageProps = PageProps<"/leads">

async function LeadsContent({ searchParams }: Pick<LeadsPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  return <LeadsListView user={user} params={params} />
}

export default function LeadsPage({ searchParams }: LeadsPageProps) {
  return (
    <div className="space-y-5">
      <PageHeader title="Список" description="Все лиды по всем воронкам: поиск, фильтры и сортировка" />
      <Suspense fallback={<SalesViewSkeleton />}>
        <LeadsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
