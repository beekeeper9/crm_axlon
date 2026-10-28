import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Building2, ChevronRight } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { fetchMe } from "@/lib/api/auth-api"
import { selectCompany } from "@/lib/auth/actions"
import { getRenderAuth } from "@/lib/auth/token-store"
import { ROLE_LABELS } from "@/lib/permissions/roles"
import { uiRoleFromBackend } from "@/lib/permissions/backend-roles"

export const metadata: Metadata = { title: "Выбор компании" }

async function CompanyList({ searchParams }: Pick<PageProps<"/select-company">, "searchParams">) {
  if (isMockDataSource) redirect(routes.myDay)
  const [{ next }, me] = await Promise.all([searchParams, fetchMe(await getRenderAuth())])

  return (
    <ul className="space-y-2">
      {me.memberships.map((membership) => (
        <li key={membership.tenant}>
          <form action={selectCompany}>
            <input type="hidden" name="tenant" value={membership.tenant} />
            {typeof next === "string" && <input type="hidden" name="next" value={next} />}
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <Building2 className="size-4 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{membership.tenant}</span>
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[uiRoleFromBackend(membership.role)]}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </button>
          </form>
        </li>
      ))}
    </ul>
  )
}

export default function SelectCompanyPage({ searchParams }: PageProps<"/select-company">) {
  return (
    <AuthShell title="Выберите компанию" description="У вас есть доступ к нескольким компаниям">
      <Suspense fallback={<Skeleton className="h-32 w-full rounded-lg" />}>
        <CompanyList searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  )
}
