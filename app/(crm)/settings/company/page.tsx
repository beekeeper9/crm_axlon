import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { homeRouteFor } from "@/config/navigation"
import { CompanySettingsView } from "@/features/company-settings"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Настройки компании" }

/** Настройки меняет директор; backend проверяет право `company.settings.manage` ещё раз */
export default async function Page() {
  const user = await getCurrentUser()
  if (!hasPermission(user.role, "company.settings")) redirect(homeRouteFor(user.role))
  return (
    <div className="mx-auto max-w-3xl">
      <CompanySettingsView />
    </div>
  )
}
