import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

import { formatNumber } from "@/lib/format"

export type SegmentedLinkItem = {
  key: string
  label: string
  href: string
  isActive: boolean
  count?: number
  icon?: LucideIcon
}

type SegmentedLinksProps = {
  label: string
  items: readonly SegmentedLinkItem[]
  /** tabs — вкладки с подчёркиванием (воронки, периоды); pill — компактный переключатель */
  variant?: "tabs" | "pill"
  /** Только иконки (подписи остаются для экранного диктора) */
  iconOnly?: boolean
  className?: string
}

/** Переключатель из ссылок: состояние в адресе, работает без JavaScript */
export function SegmentedLinks({ label, items, variant = "tabs", iconOnly = false, className }: SegmentedLinksProps) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex shrink-0",
        variant === "tabs" ? "-mb-px gap-1 overflow-x-auto" : "gap-0.5 rounded-lg bg-muted p-0.5",
        className
      )}
    >
      {items.map(({ key, label: itemLabel, href, isActive, count, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          scroll={false}
          aria-current={isActive ? "page" : undefined}
          title={iconOnly ? itemLabel : undefined}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
            variant === "tabs"
              ? "h-9 border-b-2 px-2.5"
              : "h-7 rounded-md px-2.5",
            variant === "tabs" &&
              (isActive
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"),
            variant === "pill" &&
              (isActive
                ? "bg-background font-medium text-foreground shadow-sm dark:bg-input/40"
                : "text-muted-foreground hover:text-foreground")
          )}
        >
          {Icon && <Icon className="size-4" aria-hidden />}
          <span className={cn(iconOnly && "sr-only")}>{itemLabel}</span>
          {count !== undefined && (
            <span className="rounded bg-muted px-1 text-xs text-muted-foreground tabular-nums">{formatNumber(count)}</span>
          )}
        </Link>
      ))}
    </nav>
  )
}
