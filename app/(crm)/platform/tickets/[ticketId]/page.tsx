import { Suspense } from "react"
import type { Metadata } from "next"

import { PlatformTicketView, PlatformSkeleton } from "@/features/platform"
import { requirePlatformAdmin } from "../../guard"

export const metadata: Metadata = { title: "Обращение" }

async function Content({ params }: Pick<PageProps<"/platform/tickets/[ticketId]">, "params">) {
  await requirePlatformAdmin()
  return <PlatformTicketView ticketId={(await params).ticketId} />
}

export default function Page({ params }: PageProps<"/platform/tickets/[ticketId]">) {
  return (
    <div className="mx-auto max-w-screen-xl">
      <Suspense fallback={<PlatformSkeleton />}>
        <Content params={params} />
      </Suspense>
    </div>
  )
}
