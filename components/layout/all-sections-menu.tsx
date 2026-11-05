"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { allSectionsFor, isNavItemActive, type NavGroup } from "@/config/navigation"
import type { Role } from "@/lib/permissions/roles"

/**
 * Каталог всех разделов по группам; используется и в меню «Прочее», и в мобильной навигации.
 * Группы идут колонками-«газетой» (CSS columns): каждая группа целиком, со своим списком, без разрыва.
 */
export function SectionCatalog({
  role,
  onNavigate,
  className,
}: {
  role: Role
  onNavigate?: () => void
  className?: string
}) {
  const pathname = usePathname()
  const groups: NavGroup[] = allSectionsFor(role)

  return (
    <div className={cn("gap-3", className)}>
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title} className="mb-3 break-inside-avoid space-y-1 rounded-lg bg-muted/30 p-2">
          <p className="px-2 pt-1 pb-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {group.title}
          </p>
          <ul>
            {group.items.map((navItem) => {
              const isActive = isNavItemActive(navItem, pathname)
              return (
                <li key={navItem.href}>
                  <Link
                    href={navItem.href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                      isActive ? "bg-accent font-medium text-primary" : "text-foreground"
                    )}
                  >
                    <navItem.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {navItem.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function AllSectionsMenu({ role }: { role: Role }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="hidden h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none data-popup-open:bg-accent data-popup-open:text-foreground lg:inline-flex">
        <LayoutGrid className="size-4" aria-hidden />
        Прочее
        <ChevronDown className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[calc(100svh-5rem)] w-[min(60rem,calc(100vw-2rem))] overflow-y-auto p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">Прочее</p>
          <p className="text-xs text-muted-foreground">Все остальные разделы · Esc — закрыть</p>
        </div>
        <SectionCatalog role={role} onNavigate={() => setOpen(false)} className="columns-2 lg:columns-3" />
      </PopoverContent>
    </Popover>
  )
}
