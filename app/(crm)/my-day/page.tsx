import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { routes } from "@/config/routes"
import { DashboardGrid } from "@/features/dashboard"
import { workspaceRepository } from "@/features/workspace"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Мой день" }

const TITLE = "Мой день"

/**
 * Набор виджетов зависит от роли: менеджер видит личный план и дела,
 * руководитель — результаты отдела.
 */
async function MyDayContent() {
  const user = await getCurrentUser()
  const layout = await workspaceRepository.getDashboardLayout(user.role)
  const isTeamView = hasPermission(user.role, "team.view")

  return (
    <>
      <PageHeader
        title={TITLE}
        description={
          isTeamView
            ? `${user.fullName} · ${user.departmentName}, текущий месяц`
            : `${user.fullName} · текущий месяц`
        }
        actions={
          !isTeamView && (
            // «В работу» ведёт к приоритетным лидам — с них начинается день менеджера
            <Link href={routes.focus} className={buttonVariants({ size: "lg" })}>
              В работу
              <ArrowRight data-icon="inline-end" aria-hidden />
            </Link>
          )
        }
      />
      <DashboardGrid layout={layout} role={user.role} />
    </>
  )
}

function MyDaySkeleton() {
  return (
    <>
      <PageHeader title={TITLE} />
      <div className="grid gap-4 xl:grid-cols-3" aria-busy="true">
        <Skeleton className="h-56 rounded-xl xl:col-span-2" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </>
  )
}

export default function MyDayPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<MyDaySkeleton />}>
        <MyDayContent />
      </Suspense>
    </div>
  )
}
