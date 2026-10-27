/**
 * Роли и права для отображения интерфейса.
 *
 * Это НЕ механизм безопасности: скрытая кнопка ничего не защищает.
 * Реальные права проверяет Python backend. Здесь решается только,
 * какие разделы и действия показать пользователю.
 */

export const ROLES = [
  "platform_admin",
  "director",
  "head_of_sales",
  "manager",
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: "Администратор платформы",
  director: "Директор",
  head_of_sales: "Руководитель отдела продаж",
  manager: "Менеджер",
}

export type Permission =
  /** Видеть показатели всей команды, а не только свои */
  | "team.view"
  /** Открывать аналитику и отчёты */
  | "analytics.view"
  /** Настраивать рабочие пространства отдела */
  | "workspace.configure"

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  platform_admin: ["team.view", "analytics.view", "workspace.configure"],
  director: ["team.view", "analytics.view", "workspace.configure"],
  head_of_sales: ["team.view", "analytics.view", "workspace.configure"],
  manager: [],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}
