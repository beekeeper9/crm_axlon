import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { homeRouteFor } from "@/config/navigation"
import { MemberCardSkeleton, MemberCardView } from "@/features/team-cabinet"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Карточка менеджера" }

type MemberPageProps = PageProps<"/team/[managerId]">

async function MemberContent({ params }: Pick<MemberPageProps, "params">) {
  const [user, { managerId }] = await Promise.all([getCurrentUser(), params])
  if (!hasPermission(user.role, "cabinet.view")) redirect(homeRouteFor(user.role))
  return <MemberCardView managerId={managerId} />
}

export default function MemberPage({ params }: MemberPageProps) {
  return (
    <div className="mx-auto max-w-screen-xl">
      <Suspense fallback={<MemberCardSkeleton />}>
        <MemberContent params={params} />
      </Suspense>
    </div>
  )
}
