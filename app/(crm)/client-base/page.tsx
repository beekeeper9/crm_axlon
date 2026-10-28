import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { ClientsView, ClientsViewSkeleton } from "@/features/clients"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "База клиентов" }

type ClientBasePageProps = PageProps<"/client-base">

async function ClientBaseContent({ searchParams }: Pick<ClientBasePageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  return <ClientsView user={user} params={params} />
}

export default function ClientBasePage({ searchParams }: ClientBasePageProps) {
  return (
    <div className="space-y-5">
      <PageHeader title="База клиентов" description="Все клиенты за всю историю: найдите по имени или телефону и откройте нужную сделку" />
      <Suspense fallback={<ClientsViewSkeleton />}>
        <ClientBaseContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
