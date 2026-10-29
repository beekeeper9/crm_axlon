import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { homeRouteFor } from "@/config/navigation"
import { CabinetView, CabinetViewSkeleton } from "@/features/team-cabinet"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Кабинет РОПа" }

type TeamPageProps = PageProps<"/team">

/**
 * Доступ: РОП, директор, админ (право cabinet.view). Остальных — на их стартовую страницу.
 * Это удобство интерфейса; данные кабинета backend обязан отдавать только этим ролям.
 */
async function TeamContent({ searchParams }: Pick<TeamPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  if (!hasPermission(user.role, "cabinet.view")) redirect(homeRouteFor(user.role))
  return <CabinetView params={params} />
}

export default function TeamPage({ searchParams }: TeamPageProps) {
  return (
    <div className="mx-auto max-w-screen-xl">
      <Suspense fallback={<CabinetViewSkeleton />}>
        <TeamContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
