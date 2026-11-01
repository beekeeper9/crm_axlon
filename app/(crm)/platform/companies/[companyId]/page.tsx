import { Suspense } from "react"
import type { Metadata } from "next"

import { PlatformCompanyView, PlatformSkeleton } from "@/features/platform"
import { requirePlatformAdmin } from "../../guard"

export const metadata: Metadata = { title: "Компания" }

async function Content({ params }: Pick<PageProps<"/platform/companies/[companyId]">, "params">) {
  await requirePlatformAdmin()
  return <PlatformCompanyView companyId={(await params).companyId} />
}

export default function Page({ params }: PageProps<"/platform/companies/[companyId]">) {
  return (
    <div className="mx-auto max-w-screen-xl">
      <Suspense fallback={<PlatformSkeleton />}>
        <Content params={params} />
      </Suspense>
    </div>
  )
}
