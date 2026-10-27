import { Suspense } from "react"
import { cn } from "cn"

import { WidgetErrorBoundary } from "@/components/shared/widget-error-boundary"
import { widgetRegistry } from "@/features/dashboard/widget-registry"
import type { WidgetSize, WorkspaceLayout } from "@/features/workspace"
import { hasPermission, type Role } from "@/lib/permissions/roles"

/** 12-колоночная сетка включается с 1280px; на узких экранах виджеты идут друг под другом */
const SIZE_CLASSES: Record<WidgetSize, string> = {
  third: "xl:col-span-4",
  half: "xl:col-span-6",
  "two-thirds": "xl:col-span-8",
  full: "xl:col-span-12",
}

type DashboardGridProps = {
  layout: WorkspaceLayout
  role: Role
}

/**
 * Отрисовывает рабочее пространство по конфигурации.
 * Каждый виджет грузится и падает независимо: свой Suspense и своя граница ошибок.
 */
export function DashboardGrid({ layout, role }: DashboardGridProps) {
  const placements = layout.widgets.filter((placement) => {
    const { permission } = widgetRegistry[placement.type]
    return !permission || hasPermission(role, permission)
  })

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {placements.map((placement) => {
        const definition = widgetRegistry[placement.type]
        const Widget = definition.component
        return (
          <div key={placement.id} className={cn("min-w-0", SIZE_CLASSES[placement.size])}>
            <WidgetErrorBoundary title={definition.title}>
              <Suspense fallback={definition.skeleton}>
                <Widget />
              </Suspense>
            </WidgetErrorBoundary>
          </div>
        )
      })}
    </div>
  )
}
