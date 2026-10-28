"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, LayoutGrid } from "lucide-react"
import { cn } from "cn"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { allSections, isNavItemActive, visibleFor, type NavGroup } from "@/config/navigation"
import type { Role } from "@/lib/permissions/roles"

/** Каталог всех разделов по группам; используется и в меню, и в мобильной навигации. */
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
  const groups: NavGroup[] = allSections
    .map((group) => ({ ...group, items: visibleFor(group.items, role) }))
    .filter((group) => group.items.length > 0)

  return (
    <div className={cn("grid gap-x-6 gap-y-5", className)}>
      {groups.map((group) => (
        <div key={group.title} className="space-y-1">
          <p className="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
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
                    <navItem.icon className="size-4 text-muted-foreground" aria-hidden />
                    {navItem.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
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
        Все разделы
        <ChevronDown className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(46rem,calc(100vw-2rem))] p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold">Все разделы</p>
          <p className="text-xs text-muted-foreground">Полный каталог доступных экранов · Esc — закрыть</p>
        </div>
        <SectionCatalog
          role={role}
          onNavigate={() => setOpen(false)}
          className="grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
        />
      </PopoverContent>
    </Popover>
  )
}
