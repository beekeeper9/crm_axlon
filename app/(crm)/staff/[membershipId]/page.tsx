import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { homeRouteFor } from "@/config/navigation"
import { StaffProfileSkeleton, StaffProfileView } from "@/features/staff"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Профиль сотрудника" }

type ProfilePageProps = PageProps<"/staff/[membershipId]">

/** Директор — любой сотрудник компании; РОП — сотрудники своего отдела (область решает backend) */
async function Content({ params }: Pick<ProfilePageProps, "params">) {
  const [user, { membershipId }] = await Promise.all([getCurrentUser(), params])
  if (!hasPermission(user.role, "staff.manage")) redirect(homeRouteFor(user.role))
  return <StaffProfileView membershipId={membershipId} isDirector={hasPermission(user.role, "company.view")} />
}

export default function ProfilePage({ params }: ProfilePageProps) {
  return (
    <div className="mx-auto max-w-screen-lg">
      <Suspense fallback={<StaffProfileSkeleton />}>
        <Content params={params} />
      </Suspense>
    </div>
  )
}
