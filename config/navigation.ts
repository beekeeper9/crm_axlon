import {
  BookOpen,
  CalendarDays,
  ClipboardList,
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
  myDay: { title: "Мой день", href: routes.myDay, icon: Sun },
  focus: { title: "Фокус", href: routes.focus, icon: Target },
  sales: { title: "Продажи", href: routes.sales, icon: Handshake },
  afterMeeting: { title: "После встречи", href: routes.afterMeeting, icon: UserCheck },
  meetings: { title: "Встречи", href: routes.meetings, icon: CalendarDays },
  tasks: { title: "Задачи", href: routes.tasks, icon: ListChecks },
  calls: { title: "Звонки", href: routes.calls, icon: Phone },
  dailyReports: { title: "Отчёты дня", href: routes.dailyReports, icon: FileBarChart },
  review: { title: "Разбор", href: routes.review, icon: MessageSquareWarning },
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

/** Верхняя панель: ежедневные разделы менеджера (порядок из ТЗ) */
export const primaryNavigation: readonly NavItem[] = [
  item.focus,
  item.sales,
  item.afterMeeting,
  item.meetings,
  item.tasks,
]

/** Отдельная кнопка ИИ-помощника в верхней панели */
export const assistantNavItem: NavItem = item.assistant

/** Меню «Все разделы» — полный каталог экранов */
export const allSections: readonly NavGroup[] = [
  { title: "Рабочее", items: [item.myDay, item.meetings, item.tasks, item.calls, item.dailyReports] },
  { title: "Продажи", items: [item.sales, item.afterMeeting, item.focus, item.review] },
  { title: "Поиск", items: [item.leads, item.clientBase] },
  { title: "Материалы", items: [item.materials, item.assistant] },
  { title: "Настройки", items: [item.workspace] },
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
