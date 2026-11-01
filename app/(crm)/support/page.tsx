import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { Skeleton } from "@/components/ui/skeleton"
import { homeRouteFor } from "@/config/navigation"
import { SupportView } from "@/features/support"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Поддержка" }

async function Content() {
  const user = await getCurrentUser()
  if (!hasPermission(user.role, "support.contact")) redirect(homeRouteFor(user.role))
  return <SupportView />
}

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Content />
      </Suspense>
    </div>
  )
}
