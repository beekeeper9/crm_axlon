import { Suspense } from "react"
import type { Metadata } from "next"

import { PlatformOverviewView, PlatformSkeleton } from "@/features/platform"
import { requirePlatformAdmin } from "./guard"

export const metadata: Metadata = { title: "Платформа" }

async function Content({ searchParams }: Pick<PageProps<"/platform">, "searchParams">) {
  await requirePlatformAdmin()
  return <PlatformOverviewView params={await searchParams} />
}

export default function Page({ searchParams }: PageProps<"/platform">) {
  return (
    <div className="mx-auto max-w-screen-xl">
      <Suspense fallback={<PlatformSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
