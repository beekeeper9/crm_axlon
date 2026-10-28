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
  "viewer",
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: "Администратор платформы",
  director: "Директор",
  head_of_sales: "Руководитель отдела продаж",
  manager: "Менеджер",
  viewer: "Наблюдатель",
}

export type Permission =
  /** Видеть показатели всей команды, а не только свои */
  | "team.view"
  /** Открывать аналитику и отчёты */
  | "analytics.view"
  /** Настраивать рабочие пространства отдела */
  | "workspace.configure"
  /** Менять сделки, задачи и встречи (этап, итог, создание) */
  | "records.edit"
  /** Ставить задачи и встречи другим сотрудникам */
  | "records.assign"

const MANAGEMENT: readonly Permission[] = [
  "team.view",
  "analytics.view",
  "workspace.configure",
  "records.edit",
  "records.assign",
]

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  platform_admin: MANAGEMENT,
  director: MANAGEMENT,
  head_of_sales: MANAGEMENT,
  manager: ["records.edit"],
  /** Только просмотр показателей команды (роль backend `viewer`) */
  viewer: ["team.view", "analytics.view"],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}
