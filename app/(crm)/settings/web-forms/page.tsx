import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { homeRouteFor } from "@/config/navigation"
import { WebFormsView, WebFormsViewSkeleton } from "@/features/web-forms"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Заявки с сайта" }

type WebFormsPageProps = PageProps<"/settings/web-forms">

/** Доступ: директор и РОП (право staff.manage); окончательно права проверяет backend */
async function WebFormsContent({ searchParams }: Pick<WebFormsPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  if (!hasPermission(user.role, "staff.manage")) redirect(homeRouteFor(user.role))
  return <WebFormsView user={user} params={params} />
}

export default function WebFormsPage({ searchParams }: WebFormsPageProps) {
  return (
    <Suspense fallback={<WebFormsViewSkeleton />}>
      <WebFormsContent searchParams={searchParams} />
    </Suspense>
  )
}
