import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { homeRouteFor } from "@/config/navigation"
import { WorkspaceView, WorkspaceViewSkeleton } from "@/features/workspace"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Рабочее пространство" }

type WorkspacePageProps = PageProps<"/workspace">

/** Доступ: директор и РОП (право workspace.configure); окончательно права проверяет backend */
async function WorkspaceContent({ searchParams }: Pick<WorkspacePageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  if (!hasPermission(user.role, "workspace.configure")) redirect(homeRouteFor(user.role))
  return <WorkspaceView user={user} params={params} />
}

export default function WorkspacePage({ searchParams }: WorkspacePageProps) {
  return (
    <Suspense fallback={<WorkspaceViewSkeleton />}>
      <WorkspaceContent searchParams={searchParams} />
    </Suspense>
  )
}
