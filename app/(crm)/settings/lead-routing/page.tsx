import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { homeRouteFor } from "@/config/navigation"
import { LeadRoutingView, LeadRoutingViewSkeleton } from "@/features/lead-routing"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Распределение лидов" }

type LeadRoutingPageProps = PageProps<"/settings/lead-routing">

/** Доступ: директор и РОП (право workspace.configure); окончательно права проверяет backend */
async function LeadRoutingContent({ searchParams }: Pick<LeadRoutingPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  if (!hasPermission(user.role, "workspace.configure")) redirect(homeRouteFor(user.role))
  return <LeadRoutingView user={user} params={params} />
}

export default function LeadRoutingPage({ searchParams }: LeadRoutingPageProps) {
  return (
    <Suspense fallback={<LeadRoutingViewSkeleton />}>
      <LeadRoutingContent searchParams={searchParams} />
    </Suspense>
  )
}
