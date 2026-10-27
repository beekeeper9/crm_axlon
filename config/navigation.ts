import {
  CalendarDays,
  ChartColumn,
  Handshake,
  LayoutDashboard,
  ListChecks,
  Phone,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react"

import { routes, type AppRoute } from "@/config/routes"
import type { Permission } from "@/lib/permissions/roles"

export type NavItem = {
  title: string
  href: AppRoute
  icon: LucideIcon
  /** Если указано — пункт виден только ролям с этим правом. */
  permission?: Permission
}

export type NavGroup = {
  title: string
  items: readonly NavItem[]
}

export const navigation: readonly NavGroup[] = [
  {
    title: "Работа",
    items: [
      { title: "Главная", href: routes.dashboard, icon: LayoutDashboard },
      { title: "Сделки", href: routes.deals, icon: Handshake },
      { title: "Контакты", href: routes.contacts, icon: Users },
      { title: "Задачи", href: routes.tasks, icon: ListChecks },
      { title: "Звонки", href: routes.calls, icon: Phone },
      { title: "Встречи", href: routes.meetings, icon: CalendarDays },
    ],
  },
  {
    title: "Управление",
    items: [
      {
        title: "Аналитика",
        href: routes.analytics,
        icon: ChartColumn,
        permission: "analytics.view",
      },
      {
        title: "Рабочее пространство",
        href: routes.workspace,
        icon: SlidersHorizontal,
        permission: "workspace.configure",
      },
    ],
  },
]

/** Находит пункт меню по пути — для заголовка в верхней панели. */
export function findNavItem(pathname: string): NavItem | undefined {
  return navigation
    .flatMap((group) => group.items)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
}
