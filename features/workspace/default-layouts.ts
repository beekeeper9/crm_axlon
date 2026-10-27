import type { WorkspaceLayout } from "@/features/workspace/schemas"
import type { Role } from "@/lib/permissions/roles"

/**
 * Шаблоны главной страницы по умолчанию (уровень платформы).
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
    { id: "kpis", type: "sales-kpis", size: "full" },
    { id: "tasks", type: "tasks-today", size: "third" },
    { id: "plan", type: "plan-trend", size: "two-thirds" },
    { id: "funnel", type: "sales-funnel", size: "full" },
  ],
}

export const defaultDashboardLayouts: Record<Role, WorkspaceLayout> = {
  platform_admin: managementLayout,
  director: managementLayout,
  head_of_sales: managementLayout,
  manager: managerLayout,
}
