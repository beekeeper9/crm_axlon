import { TriangleAlert } from "lucide-react"

import { isMockDataSource } from "@/config/env"
import { fetchPlanUsage } from "@/features/plan-limits/api/plan-usage"
import { METRIC_LABELS, type MetricUsage } from "@/features/plan-limits/schemas"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { formatNumber } from "@/lib/format"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"
import { cn } from "@/lib/utils"

function describe(metric: MetricUsage): string {
  const counts = `${formatNumber(metric.used ?? 0)} из ${formatNumber(metric.limit)}`
  return metric.state === "reached"
    ? `${METRIC_LABELS[metric.metric]}: лимит исчерпан (${counts}) — новые записи не создаются`
    : `${METRIC_LABELS[metric.metric]}: ${counts}`
}

/**
 * Предупреждение директору о лимитах тарифа: от 80% использования и при исчерпании.
 * Это подсказка, а не часть рабочего экрана: при ошибке API блок просто не показывается.
 */
export async function PlanLimitsBanner() {
  if (isMockDataSource) return null
  const user = await getCurrentUser()
  if (!hasPermission(user.role, "company.settings")) return null
  const loaded = await tryLoad(async () => fetchPlanUsage(await getRenderAuth()))
  if (!loaded.ok) return null
  const alerts = loaded.data.metrics.filter((metric) => metric.state !== "ok")
  if (alerts.length === 0) return null
  const reached = alerts.some((metric) => metric.state === "reached")
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 border-b px-4 py-2 text-sm md:px-6 lg:px-8 print:hidden",
        reached ? "border-destructive/30 bg-destructive/8" : "border-warning/30 bg-warning/10"
      )}
    >
      <TriangleAlert className={cn("mt-0.5 size-4 shrink-0", reached ? "text-destructive" : "text-warning")} aria-hidden />
      <p>
        <span className="font-medium">{reached ? "Лимит тарифа исчерпан." : "Лимит тарифа скоро закончится."}</span>{" "}
        {alerts.map(describe).join("; ")}. Чтобы увеличить лимит, обратитесь к администратору платформы.
      </p>
    </div>
  )
}
