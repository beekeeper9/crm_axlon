import { Suspense } from "react"
import type { Metadata } from "next"

import { PlatformCompaniesView, PlatformSkeleton } from "@/features/platform"
import { requirePlatformAdmin } from "../guard"

export const metadata: Metadata = { title: "Компании" }

async function Content({ searchParams }: Pick<PageProps<"/platform/companies">, "searchParams">) {
  await requirePlatformAdmin()
  return <PlatformCompaniesView params={await searchParams} />
}

export default function Page({ searchParams }: PageProps<"/platform/companies">) {
  return (
    <div className="mx-auto max-w-screen-xl">
      <Suspense fallback={<PlatformSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
