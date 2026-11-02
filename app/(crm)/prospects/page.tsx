import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { ProspectsView, ProspectsViewSkeleton } from "@/features/prospects"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Входящие лиды" }

type ProspectsPageProps = PageProps<"/prospects">

async function ProspectsContent({ searchParams }: Pick<ProspectsPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  return <ProspectsView user={user} params={params} />
}

export default function ProspectsPage({ searchParams }: ProspectsPageProps) {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Входящие лиды"
        description="Заявки до клиента и сделки: квалифицируйте, проверьте дубли и конвертируйте в клиента"
      />
      <Suspense fallback={<ProspectsViewSkeleton />}>
        <ProspectsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
