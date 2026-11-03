import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { isMockDataSource } from "@/config/env"
import { homeRouteFor } from "@/config/navigation"
import { MemberCardSkeleton, MemberCardView, ServerMemberCardView } from "@/features/team-cabinet"
import { getParam } from "@/lib/search-params"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Карточка менеджера" }

type MemberPageProps = PageProps<"/team/[managerId]">

async function MemberContent({ params, searchParams }: Pick<MemberPageProps, "params" | "searchParams">) {
  const [user, { managerId }, query] = await Promise.all([getCurrentUser(), params, searchParams])
  if (!hasPermission(user.role, "cabinet.view")) redirect(homeRouteFor(user.role))
  if (isMockDataSource) return <MemberCardView managerId={managerId} />
  return <ServerMemberCardView managerId={managerId} dateFrom={getParam(query, "date_from")} dateTo={getParam(query, "date_to")} />
}

export default function MemberPage({ params, searchParams }: MemberPageProps) {
  return (
    <div className="mx-auto max-w-screen-xl">
      <Suspense fallback={<MemberCardSkeleton />}>
        <MemberContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
