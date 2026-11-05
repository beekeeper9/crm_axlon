import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/shared/page-header"
import { isMockDataSource } from "@/config/env"
import { homeRouteFor } from "@/config/navigation"
import { ProductsSection } from "@/features/products"
import { ReferenceListsView, ReferenceListsViewSkeleton } from "@/features/reference-lists"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Справочники" }

/** Директор меняет справочники, РОП их видит; продукты ведут оба. Backend проверяет права ещё раз */
async function Content() {
  const user = await getCurrentUser()
  if (!hasPermission(user.role, "cabinet.view")) redirect(homeRouteFor(user.role))
  return (
    <div className="space-y-8">
      {!isMockDataSource && <ProductsSection editable={hasPermission(user.role, "pipelines.configure")} />}
      <ReferenceListsView editable={hasPermission(user.role, "company.settings")} />
    </div>
  )
}

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Справочники" description="Продукты компании и списки, из которых сотрудники выбирают причины и источники. Продукты ведут директор и РОП, остальные списки меняет директор." />
      <Suspense fallback={<ReferenceListsViewSkeleton />}>
        <Content />
      </Suspense>
    </div>
  )
}
