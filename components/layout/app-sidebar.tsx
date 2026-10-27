"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { navigation } from "@/config/navigation"
import { routes } from "@/config/routes"
import { siteConfig } from "@/config/site"
import { formatInitials } from "@/lib/format"
import { hasPermission, ROLE_LABELS } from "@/lib/permissions/roles"
import type { CurrentUser } from "@/lib/session/current-user"

type AppSidebarProps = {
  user: CurrentUser
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  // Пункты без права видны всем; это только отображение, доступ проверяет backend
  const groups = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || hasPermission(user.role, item.permission)
      ),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href={routes.dashboard} />}>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                {siteConfig.name.slice(0, 1)}
              </div>
              <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">{siteConfig.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.companyName}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        // На телефоне меню открыто поверх страницы — закрываем после перехода
                        onClick={() => setOpenMobile(false)}
                        render={
                          <Link
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                          />
                        }
                      >
                        <item.icon aria-hidden />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2.5 rounded-md p-1.5 group-data-[collapsible=icon]:p-0">
          <Avatar>
            <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
              {formatInitials(user.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">{user.fullName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
