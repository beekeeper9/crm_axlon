import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Settings2 } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { isMockDataSource } from "@/config/env"
import { SalesOverview } from "@/features/departments"
import { SalesView, SalesViewSkeleton } from "@/features/sales"
import { FUNNEL_SETTINGS_PATH } from "@/features/sales/funnel/funnel-settings-view"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Продажи" }

type SalesPageProps = PageProps<"/sales">

async function SalesContent({ searchParams }: Pick<SalesPageProps, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  // Директору — цифры компании и отделов вместо воронки с накопленными сделками
  if (!isMockDataSource && hasPermission(user.role, "company.view")) return <SalesOverview params={params} />
  return <SalesView user={user} params={params} />
}

/** Заголовок; РОПу и директору — переход к настройке этапов воронки */
async function SalesHeader() {
  const user = await getCurrentUser()
  const canConfigure = !isMockDataSource && hasPermission(user.role, "pipelines.configure")
  return (
    <PageHeader
      title="Продажи"
      description="План, факт, предоплаты и лиды компании и отделов; для менеджеров — сделки по воронкам"
      actions={
        canConfigure ? (
          <Link href={FUNNEL_SETTINGS_PATH} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Settings2 data-icon="inline-start" aria-hidden />
            Настроить воронку
          </Link>
        ) : undefined
      }
    />
  )
}

export default function SalesPage({ searchParams }: SalesPageProps) {
  return (
    <div className="space-y-5">
      <Suspense fallback={<PageHeader title="Продажи" description="План, факт, предоплаты и лиды компании и отделов; для менеджеров — сделки по воронкам" />}>
        <SalesHeader />
      </Suspense>
      <Suspense fallback={<SalesViewSkeleton />}>
        <SalesContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
