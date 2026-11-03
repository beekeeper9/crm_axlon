import { Suspense } from "react"
import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { ReviewView } from "@/features/review/components/review-view"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Работа над ошибками" }

/** Выдавать разборы может руководитель (право назначать работу сотрудникам) */
async function ReviewContent() {
  const user = await getCurrentUser()
  return <ReviewView canIssue={hasPermission(user.role, "records.assign")} />
}

export default function ReviewPage() {
  if (isMockDataSource) {
    return (
      <UpcomingSection
        href={routes.review}
        description="Сделки, которые РОП вернул менеджеру на доработку"
        plannedFeatures={["Пакеты разбора хранятся на backend — в демо-режиме их нет"]}
      />
    )
  }
  return (
    <div className="mx-auto max-w-5xl">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ReviewContent />
      </Suspense>
    </div>
  )
}
