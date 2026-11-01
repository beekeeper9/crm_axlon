import { Suspense } from "react"
import type { Metadata } from "next"

import { PlatformErrorsView, PlatformSkeleton } from "@/features/platform"
import { requirePlatformAdmin } from "../guard"

export const metadata: Metadata = { title: "Ошибки платформы" }

async function Content({ searchParams }: Pick<PageProps<"/platform/errors">, "searchParams">) {
  await requirePlatformAdmin()
  return <PlatformErrorsView params={await searchParams} />
}

export default function Page({ searchParams }: PageProps<"/platform/errors">) {
  return (
    <div className="mx-auto max-w-screen-xl">
      <Suspense fallback={<PlatformSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
