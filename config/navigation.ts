import {
  BookOpen,
  ReceiptText,
  Globe,
  Shuffle,
  CalendarDays,
  ClipboardList,
  Gauge,
  Building2,
  LifeBuoy,
  ShieldCheck,
  UsersRound,
  Database,
  FileBarChart,
  Handshake,
  Inbox,
  ListChecks,
  MessageSquareWarning,
  Phone,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  Settings,
  ListOrdered,
  History,
  Plug,
  MessageSquareText,
  Upload,
  Bell,
  TriangleAlert,
  UserCheck,
  type LucideIcon,
} from "lucide-react"

import { routes, type AppRoute } from "@/config/routes"
import { hasPermission, type Permission, type Role } from "@/lib/permissions/roles"

export type NavItem = {
  title: string
  href: AppRoute
  icon: LucideIcon
  /** Если указано — пункт виден только ролям с этим правом */
  permission?: Permission
  /** Активен только на своём адресе, а не на вложенных (например, «Обзор» платформы) */
  exact?: boolean
}

export type NavGroup = {
  title: string
  items: readonly NavItem[]
}

const item = {
  myDay: { title: "Мой день", href: routes.myDay, icon: Sun, permission: "my_day.view" },
  cabinet: { title: "Мой кабинет", href: routes.team, icon: Gauge, permission: "cabinet.view" },
  heads: { title: "РОПы", href: routes.heads, icon: Gauge, permission: "company.view" },
  company: { title: "Компания", href: routes.company, icon: Building2, permission: "company.view" },
  staff: { title: "Сотрудники", href: routes.staff, icon: UsersRound, permission: "staff.manage" },
  platform: { title: "Обзор", href: routes.platform, icon: ShieldCheck, permission: "platform.manage", exact: true },
  platformCompanies: { title: "Компании", href: routes.platformCompanies, icon: Building2, permission: "platform.manage" },
  platformErrors: { title: "Ошибки", href: routes.platformErrors, icon: TriangleAlert, permission: "platform.manage" },
  platformTickets: { title: "Обращения", href: routes.platformTickets, icon: LifeBuoy, permission: "platform.manage" },
  support: { title: "Поддержка", href: routes.support, icon: LifeBuoy, permission: "support.contact" },
  settingsCompany: { title: "Настройки компании", href: routes.settingsCompany, icon: Settings, permission: "company.settings" },
  settingsReferenceLists: { title: "Справочники", href: routes.settingsReferenceLists, icon: ListOrdered, permission: "staff.manage" },
  settingsAudit: { title: "Журнал изменений", href: routes.settingsAudit, icon: History, permission: "audit.view" },
  settingsIntegrations: { title: "Интеграции", href: routes.settingsIntegrations, icon: Plug, permission: "company.settings" },
  settingsTemplates: { title: "Шаблоны сообщений", href: routes.settingsTemplates, icon: MessageSquareText },
  settingsLeadRouting: { title: "Распределение лидов", href: routes.settingsLeadRouting, icon: Shuffle, permission: "staff.manage" },
  settingsWebForms: { title: "Заявки с сайта", href: routes.settingsWebForms, icon: Globe, permission: "staff.manage" },
  paymentReview: { title: "Проверка оплат", href: routes.paymentReview, icon: ReceiptText, permission: "staff.manage" },
  settingsImport: { title: "Импорт", href: routes.settingsImport, icon: Upload, permission: "records.edit" },
  profileNotifications: { title: "Уведомления", href: routes.profileNotifications, icon: Bell },
  focus: { title: "Фокус", href: routes.focus, icon: Target },
  sales: { title: "Продажи", href: routes.sales, icon: Handshake },
  afterMeeting: { title: "После встречи", href: routes.afterMeeting, icon: UserCheck },
  meetings: { title: "Встречи", href: routes.meetings, icon: CalendarDays },
  tasks: { title: "Задачи", href: routes.tasks, icon: ListChecks },
  calls: { title: "Звонки", href: routes.calls, icon: Phone },
  dailyReports: { title: "Отчёты", href: routes.dailyReports, icon: FileBarChart, permission: "cabinet.view" },
  review: { title: "Работа над ошибками", href: routes.review, icon: MessageSquareWarning },
  leads: { title: "Список", href: routes.leads, icon: ClipboardList },
  prospects: { title: "Входящие лиды", href: routes.prospects, icon: Inbox },
  clientBase: { title: "База клиентов", href: routes.clientBase, icon: Database },
  materials: { title: "Материалы", href: routes.materials, icon: BookOpen },
  assistant: { title: "ИИ-помощник", href: routes.assistant, icon: Sparkles },
  workspace: {
    title: "Рабочее пространство",
    href: routes.workspace,
    icon: SlidersHorizontal,
    permission: "workspace.configure",
  },
} satisfies Record<string, NavItem>

/**
 * Верхняя панель зависит от роли: менеджер начинает с «Моего дня», РОП — с «Моего кабинета»,
 * директор — с «Компании» и «РОПов», администратор платформы — с её разделов.
 */
const personalNavigation: readonly NavItem[] = [item.myDay, item.focus, item.prospects, item.sales, item.afterMeeting, item.meetings, item.tasks]
const teamNavigation: readonly NavItem[] = [item.cabinet, item.prospects, item.sales, item.meetings, item.tasks, item.calls, item.staff]
const directorNavigation: readonly NavItem[] = [item.company, item.heads, item.prospects, item.sales, item.staff]
const platformNavigation: readonly NavItem[] = [item.platform, item.platformCompanies, item.platformErrors, item.platformTickets]

export function primaryNavigationFor(role: Role): NavItem[] {
  if (hasPermission(role, "platform.manage")) return visibleFor(platformNavigation, role)
  if (hasPermission(role, "company.view")) return visibleFor(directorNavigation, role)
  return visibleFor(hasPermission(role, "team.view") ? teamNavigation : personalNavigation, role)
}

/**
 * Стартовая страница роли — её определяет система по реальной роли после входа:
 * администратор платформы — «Платформа», директор — «Компания», РОП — «Кабинет РОПа»,
 * менеджер — «Мой день», наблюдатель — «Продажи».
 */
export function homeRouteFor(role: Role): AppRoute {
  if (hasPermission(role, "platform.manage")) return routes.platform
  if (hasPermission(role, "company.view")) return routes.company
  if (hasPermission(role, "cabinet.view")) return routes.team
  if (hasPermission(role, "my_day.view")) return routes.myDay
  return routes.sales
}

/** Отдельная кнопка ИИ-помощника в верхней панели */
export const assistantNavItem: NavItem = item.assistant

/** Меню «Прочее» директора — согласованный состав */
const directorSections: readonly NavGroup[] = [
  { title: "Работа", items: [item.tasks, item.calls, item.sales, item.focus] },
  { title: "Контроль", items: [item.dailyReports, item.paymentReview, item.clientBase] },
  { title: "Инструменты", items: [item.assistant, item.workspace, item.support] },
  {
    title: "Настройки",
    items: [
      item.settingsCompany,
      item.settingsReferenceLists,
      item.settingsLeadRouting,
      item.settingsWebForms,
      item.settingsAudit,
      item.settingsIntegrations,
      item.settingsTemplates,
      item.settingsImport,
      item.profileNotifications,
    ],
  },
]

/** Меню «Прочее» остальных ролей — полный каталог экранов */
const teamSections: readonly NavGroup[] = [
  { title: "Рабочее", items: [item.myDay, item.meetings, item.tasks, item.calls] },
  { title: "Продажи", items: [item.sales, item.afterMeeting, item.focus] },
  { title: "Контроль продаж", items: [item.cabinet, item.dailyReports, item.paymentReview, item.review] },
  { title: "Поиск", items: [item.prospects, item.leads, item.clientBase] },
  { title: "Материалы", items: [item.materials, item.assistant] },
  { title: "Управление", items: [item.staff, item.workspace, item.support] },
  {
    title: "Настройки",
    items: [item.settingsReferenceLists, item.settingsLeadRouting, item.settingsWebForms, item.settingsAudit, item.settingsTemplates, item.settingsImport, item.profileNotifications],
  },
]

export function allSectionsFor(role: Role): NavGroup[] {
  if (hasPermission(role, "platform.manage")) return []
  const groups = hasPermission(role, "company.view") ? directorSections : teamSections
  return groups.map((group) => ({ ...group, items: visibleFor(group.items, role) })).filter((group) => group.items.length > 0)
}

const allItems: readonly NavItem[] = Object.values(item)

/** Находит раздел по пути — для заголовков и активного пункта. */
export function findNavItem(pathname: string): NavItem | undefined {
  return allItems.find(
    (navItem) => pathname === navItem.href || (!navItem.exact && pathname.startsWith(`${navItem.href}/`))
  )
}

/** Пункты, видимые роли. Это только отображение — доступ проверяет backend. */
export function visibleFor<T extends NavItem>(items: readonly T[], role: Role): T[] {
  return items.filter((navItem) => !navItem.permission || hasPermission(role, navItem.permission))
}

export function isNavItemActive(navItem: NavItem, pathname: string): boolean {
  return pathname === navItem.href || (!navItem.exact && pathname.startsWith(`${navItem.href}/`))
}
