import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/shared/page-header"
import { homeRouteFor } from "@/config/navigation"
import { IntegrationsView, IntegrationsViewSkeleton } from "@/features/integrations"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Интеграции" }

/** Раздел директора; backend проверяет право integrations.manage ещё раз */
async function Content() {
  const user = await getCurrentUser()
  if (!hasPermission(user.role, "company.settings")) redirect(homeRouteFor(user.role))
  return <IntegrationsView />
}

export default function Page() {
  return (
    <div className="mx-auto max-w-screen-lg space-y-5">
      <PageHeader title="Интеграции" description="Мессенджеры и телефония: принимаются ли события, подключена ли отправка и что пошло не так" />
      <Suspense fallback={<IntegrationsViewSkeleton />}>
        <Content />
      </Suspense>
    </div>
  )
}
