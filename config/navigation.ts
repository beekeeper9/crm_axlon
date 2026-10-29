import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Gauge,
  Building2,
  ShieldCheck,
  UsersRound,
  Database,
  FileBarChart,
  Handshake,
  ListChecks,
  MessageSquareWarning,
  Phone,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
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
}

export type NavGroup = {
  title: string
  items: readonly NavItem[]
}

const item = {
  myDay: { title: "Мой день", href: routes.myDay, icon: Sun, permission: "my_day.view" },
  cabinet: { title: "Кабинет РОПа", href: routes.team, icon: Gauge, permission: "cabinet.view" },
  company: { title: "Компания", href: routes.company, icon: Building2, permission: "company.view" },
  staff: { title: "Сотрудники", href: routes.staff, icon: UsersRound, permission: "staff.manage" },
  platform: { title: "Платформа", href: routes.platform, icon: ShieldCheck, permission: "platform.manage" },
  focus: { title: "Фокус", href: routes.focus, icon: Target },
  sales: { title: "Продажи", href: routes.sales, icon: Handshake },
  afterMeeting: { title: "После встречи", href: routes.afterMeeting, icon: UserCheck },
  meetings: { title: "Встречи", href: routes.meetings, icon: CalendarDays },
  tasks: { title: "Задачи", href: routes.tasks, icon: ListChecks },
  calls: { title: "Звонки", href: routes.calls, icon: Phone },
  dailyReports: { title: "Отчёты дня", href: routes.dailyReports, icon: FileBarChart },
  review: { title: "Работа над ошибками", href: routes.review, icon: MessageSquareWarning },
  leads: { title: "Список", href: routes.leads, icon: ClipboardList },
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
 * Верхняя панель зависит от рабочего пространства:
 * менеджер начинает с «Моего дня» и работы со своими сделками,
 * руководитель — с «Кабинета РОПа» и контроля встреч, задач и звонков.
 */
const personalNavigation: readonly NavItem[] = [item.myDay, item.focus, item.sales, item.afterMeeting, item.meetings, item.tasks]
const teamNavigation: readonly NavItem[] = [item.cabinet, item.sales, item.meetings, item.tasks, item.calls, item.staff]
const directorNavigation: readonly NavItem[] = [item.company, item.cabinet, item.sales, item.staff]
const platformNavigation: readonly NavItem[] = [item.platform]

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

/** Меню «Все разделы» — полный каталог экранов */
export const allSections: readonly NavGroup[] = [
  { title: "Рабочее", items: [item.myDay, item.meetings, item.tasks, item.calls] },
  { title: "Продажи", items: [item.sales, item.afterMeeting, item.focus] },
  { title: "Контроль продаж", items: [item.cabinet, item.dailyReports, item.review] },
  { title: "Поиск", items: [item.leads, item.clientBase] },
  { title: "Материалы", items: [item.materials, item.assistant] },
  { title: "Управление", items: [item.company, item.staff, item.platform, item.workspace] },
]

const allItems: readonly NavItem[] = Object.values(item)

/** Находит раздел по пути — для заголовков и активного пункта. */
export function findNavItem(pathname: string): NavItem | undefined {
  return allItems.find(
    (navItem) => pathname === navItem.href || pathname.startsWith(`${navItem.href}/`)
  )
}

/** Пункты, видимые роли. Это только отображение — доступ проверяет backend. */
export function visibleFor<T extends NavItem>(items: readonly T[], role: Role): T[] {
  return items.filter((navItem) => !navItem.permission || hasPermission(role, navItem.permission))
}

export function isNavItemActive(navItem: NavItem, pathname: string): boolean {
  return pathname === navItem.href || pathname.startsWith(`${navItem.href}/`)
}
