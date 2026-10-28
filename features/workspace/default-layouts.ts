import type { WorkspaceLayout } from "@/features/workspace/schemas"
import type { Role } from "@/lib/permissions/roles"

/**
 * Шаблоны «Мой день» по умолчанию (уровень платформы).
 * Позже РОП сможет менять раскладку для отдела, а эти шаблоны останутся отправной точкой.
 */
const managementLayout: WorkspaceLayout = {
  id: "default-management",
  name: "Руководитель",
  widgets: [
    { id: "kpis", type: "sales-kpis", size: "full" },
    { id: "plan", type: "plan-trend", size: "two-thirds" },
    { id: "attention", type: "attention", size: "third" },
    { id: "team", type: "team-performance", size: "full" },
    { id: "funnel", type: "sales-funnel", size: "two-thirds" },
    { id: "tasks", type: "tasks-today", size: "third" },
  ],
}

const managerLayout: WorkspaceLayout = {
  id: "default-manager",
  name: "Менеджер",
  widgets: [
    { id: "now", type: "now-strip", size: "full" },
    { id: "turnover", type: "personal-turnover", size: "two-thirds" },
    { id: "earnings", type: "earnings", size: "third" },
    { id: "kpis", type: "personal-kpis", size: "full" },
    { id: "month", type: "meetings-funnel", size: "half" },
    { id: "daily", type: "daily-dynamics", size: "half" },
    { id: "segments", type: "sales-segments", size: "full" },
  ],
}

export const defaultDashboardLayouts: Record<Role, WorkspaceLayout> = {
  platform_admin: managementLayout,
  director: managementLayout,
  head_of_sales: managementLayout,
  manager: managerLayout,
}
