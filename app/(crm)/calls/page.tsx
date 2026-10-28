import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { CallsView, CallsViewSkeleton } from "@/features/calls"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Звонки" }

type CallsPageProps = PageProps<"/calls">

async function CallsContent({ searchParams }: Pick<CallsPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  return <CallsView user={user} params={params} />
}

export default function CallsPage({ searchParams }: CallsPageProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="Звонки" description="История разговоров с клиентами, разбор и транскрипции" />
      <Suspense fallback={<CallsViewSkeleton />}>
        <CallsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
