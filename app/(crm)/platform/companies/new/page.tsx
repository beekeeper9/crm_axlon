import { Suspense } from "react"
import type { Metadata } from "next"

import { PlatformCompanyNewView, PlatformSkeleton } from "@/features/platform"
import { requirePlatformAdmin } from "../../guard"

export const metadata: Metadata = { title: "Подключить компанию" }

async function Content() {
  await requirePlatformAdmin()
  return <PlatformCompanyNewView />
}

export default function Page() {
  return (
    <div className="mx-auto max-w-screen-xl">
      <Suspense fallback={<PlatformSkeleton />}>
        <Content />
      </Suspense>
    </div>
  )
}
