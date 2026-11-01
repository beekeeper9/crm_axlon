import { Suspense } from "react"
import type { Metadata } from "next"

import { PlatformTicketsView, PlatformSkeleton } from "@/features/platform"
import { requirePlatformAdmin } from "../guard"

export const metadata: Metadata = { title: "Обращения компаний" }

async function Content({ searchParams }: Pick<PageProps<"/platform/tickets">, "searchParams">) {
  await requirePlatformAdmin()
  return <PlatformTicketsView params={await searchParams} />
}

export default function Page({ searchParams }: PageProps<"/platform/tickets">) {
  return (
    <div className="mx-auto max-w-screen-xl">
      <Suspense fallback={<PlatformSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
