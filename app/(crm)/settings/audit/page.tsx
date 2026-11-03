import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { homeRouteFor } from "@/config/navigation"
import { AuditJournalView } from "@/features/company-settings"
import { hasPermission } from "@/lib/permissions/roles"
import type { SearchParamsRecord } from "@/lib/search-params"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Журнал изменений" }

/** Директор видит всю компанию, РОП — действия сотрудников своего отдела; область задаёт backend */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  if (!hasPermission(user.role, "audit.view")) redirect(homeRouteFor(user.role))
  const scopeHint =
    user.role === "director"
      ? "Кто и что менял в компании: сделки, клиенты, планы, сотрудники и настройки."
      : "Кто и что менял в вашем отделе: действия руководителя и менеджеров отдела."
  return (
    <div className="mx-auto max-w-screen-lg">
      <AuditJournalView params={params} scopeHint={scopeHint} />
    </div>
  )
}
