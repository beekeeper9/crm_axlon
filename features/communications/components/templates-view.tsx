import { MessageSquareText } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { fetchTemplates } from "@/features/communications/api/communications-repository"
import { TemplatesManager } from "@/features/communications/components/templates-manager"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { hasPermission } from "@/lib/permissions/roles"
import type { CurrentUser } from "@/lib/session/current-user"

/** Шаблоны ответов компании. Менять могут директор и РОП — backend проверяет право staff.manage */
export async function TemplatesView({ user }: { user: CurrentUser }) {
  if (isMockDataSource) {
    return (
      <ListPanel>
        <EmptyState icon={MessageSquareText} title="Шаблоны хранятся на сервере" description="В демо-режиме их нет." />
      </ListPanel>
    )
  }
  const templates = await tryLoad(async () => fetchTemplates(await getRenderAuth()))
  if (!templates.ok) return <ApiErrorState error={templates.error} />
  return <TemplatesManager templates={templates.data} canManage={hasPermission(user.role, "staff.manage")} />
}

export function TemplatesViewSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  )
}
