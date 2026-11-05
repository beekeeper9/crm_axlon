"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

import {
  assistantNavItem,
  isNavItemActive,
  primaryNavigationFor,
} from "@/config/navigation"
import type { Role } from "@/lib/permissions/roles"

const LINK_CLASSES =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"

/** Сколько пунктов с подписями помещается в шапке шириной 1280 px */
const COMPACT_UNTIL_XL = 6

export function PrimaryNav({ role }: { role: Role }) {
  const pathname = usePathname()
  const items = primaryNavigationFor(role)
  // Подписи с иконками помещаются в 1280 px лишь при коротком меню; длинному (менеджеру — 7
  // пунктов) нужно 1440 px, иначе последний пункт наезжает на «Прочее»
  const labelClass = items.length > COMPACT_UNTIL_XL ? "max-[90rem]:sr-only" : "max-xl:sr-only"

  return (
    <nav aria-label="Основные разделы" className="hidden items-center gap-0.5 lg:flex">
      {items.map((navItem) => {
        const isActive = isNavItemActive(navItem, pathname)
        return (
          <Link
            key={navItem.href}
            href={navItem.href}
            aria-current={isActive ? "page" : undefined}
            title={navItem.title}
            className={cn(LINK_CLASSES, isActive && "bg-accent text-foreground")}
          >
            <navItem.icon className="size-4" aria-hidden />
            {/* На узких ноутбуках — только иконки (подпись — во всплывающей подсказке), чтобы панель помещалась */}
            <span className={labelClass}>{navItem.title}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function AssistantLink() {
  const pathname = usePathname()
  const isActive = isNavItemActive(assistantNavItem, pathname)

  return (
    <Link
      href={assistantNavItem.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        LINK_CLASSES,
        "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
        isActive && "border-primary/60 bg-primary/20"
      )}
    >
      <assistantNavItem.icon className="size-4" aria-hidden />
      <span className="hidden xl:inline">{assistantNavItem.title}</span>
      <span className="xl:hidden">ИИ</span>
    </Link>
  )
}
