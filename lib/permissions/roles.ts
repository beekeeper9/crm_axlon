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
  "lead_caller",
  "operations",
  "viewer",
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: "Администратор платформы",
  director: "Директор",
  head_of_sales: "Руководитель отдела продаж",
  manager: "Менеджер",
  lead_caller: "Первичная обработка лидов",
  operations: "Операционный отдел",
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
  /** Раздел «Сотрудники»: сотрудники своей области (директор — компания, РОП — свой отдел) */
  | "staff.manage"
  /** Создавать и отключать аккаунты: директор — в компании, РОП — менеджеров своего отдела */
  | "staff.hire"
  /** Решать по заявкам на найм и увольнение — директор */
  | "staff.approve"
  /** Рабочее пространство директора: компания и отделы */
  | "company.view"
  /** Панель администратора платформы: компании, подписки, ошибки и обращения */
  | "platform.manage"
  /** Обращения в поддержку платформы — у сотрудников компаний */
  | "support.contact"
  /** Настраивать этапы воронки: РОП — воронку своего отдела, директор — любую */
  | "pipelines.configure"
  /** Журнал изменений: директор — вся компания, РОП — действия сотрудников своего отдела */
  | "audit.view"
  /** Настройки компании: название, страна, валюта, часовой пояс — директор */
  | "company.settings"
  /** Боковая панель чатов: какие диалоги видны, решает backend (менеджер — свои, РОП — отдел) */
  | "chats.view"
  /** Подключение мессенджера компании — директор и РОП */
  | "chats.connect"

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
  director: [...MANAGEMENT, "staff.manage", "staff.hire", "staff.approve", "company.view", "support.contact", "pipelines.configure", "audit.view", "company.settings", "chats.view", "chats.connect"],
  head_of_sales: [...MANAGEMENT, "staff.manage", "staff.hire", "support.contact", "pipelines.configure", "audit.view", "chats.view", "chats.connect"],
  manager: ["records.edit", "my_day.view", "support.contact", "chats.view"],
  /**
   * Роли P0 backend. Их рабочие пространства в продукте ещё не описаны — пока минимальный набор:
   * работа со своими записями, без «Моего дня» и командных разделов. Данные ограничивает backend.
   */
  lead_caller: ["records.edit", "support.contact"],
  operations: ["records.edit", "support.contact"],
  /** Только просмотр показателей команды (роль backend `viewer`) */
  viewer: ["team.view", "analytics.view", "support.contact"],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

/**
 * Иерархия создания аккаунтов: кто кого может создать. Роль нового аккаунта не выбирается
 * в форме — её назначает сервер по роли создателя. Здесь — только чтобы подписать форму.
 */
export const CREATABLE_ROLE: Partial<Record<Role, Role>> = {
  director: "head_of_sales",
  head_of_sales: "manager",
}
