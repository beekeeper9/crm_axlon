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
  /** «Кабинет РОПа»: РОП, директор, админ (ТЗ «Кабинет РОПа», п. 4.1) */
  | "cabinet.view"
  /** Личное рабочее пространство «Мой день» с личным планом — у менеджера по продажам */
  | "my_day.view"
  /** Видеть сотрудников своей области и создавать аккаунты уровнем ниже (директор → РОП, РОП → менеджер) */
  | "staff.manage"
  /** Рабочее пространство директора: компания и отделы */
  | "company.view"
  /** Панель администратора платформы: компании и аккаунты директоров */
  | "platform.manage"

const MANAGEMENT: readonly Permission[] = [
  "team.view",
  "analytics.view",
  "workspace.configure",
  "records.edit",
  "records.assign",
  "cabinet.view",
]

/**
 * Администратор платформы управляет доступом к CRM, а не продажами компаний:
 * у него нет прав на данные отделов. Директор и РОП управляют сотрудниками уровнем ниже.
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  platform_admin: ["platform.manage"],
  director: [...MANAGEMENT, "staff.manage", "company.view"],
  head_of_sales: [...MANAGEMENT, "staff.manage"],
  manager: ["records.edit", "my_day.view"],
  /** Только просмотр показателей команды (роль backend `viewer`) */
  viewer: ["team.view", "analytics.view"],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

/**
 * Иерархия создания аккаунтов: кто кого может создать. Роль нового аккаунта не выбирается
 * в форме — её назначает сервер по роли создателя. Здесь — только чтобы подписать форму.
 */
export const CREATABLE_ROLE: Partial<Record<Role, Role>> = {
  platform_admin: "director",
  director: "head_of_sales",
  head_of_sales: "manager",
}
