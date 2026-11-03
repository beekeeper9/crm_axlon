import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { homeRouteFor } from "@/config/navigation"
import { fetchPreferences, NotificationSettings } from "@/features/notifications"
import { tryLoad } from "@/lib/api/load"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Уведомления" }

/** Настройки уведомлений текущего пользователя; у администратора платформы их нет (нет компании) */
async function Content() {
  const user = await getCurrentUser()
  if (hasPermission(user.role, "platform.manage")) redirect(homeRouteFor(user.role))
  if (isMockDataSource) {
    return <p className="text-sm text-muted-foreground">В демо-режиме уведомления и их настройки не работают — запустите CRM с сервером.</p>
  }
  const loaded = await tryLoad(fetchPreferences)
  return loaded.ok ? <NotificationSettings initial={loaded.data} /> : <ApiErrorState error={loaded.error} />
}

export default function NotificationSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Уведомления" description="Что приходит в колокольчик и когда напоминать о сроках задач." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Content />
      </Suspense>
    </div>
  )
}
