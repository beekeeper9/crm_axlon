import Link from "next/link"
import { cn } from "@/lib/utils"

import { routes } from "@/config/routes"
import { formatInitials, formatNumber } from "@/lib/format"

type ManagerFilterProps = {
  managers: readonly { id: string; name: string; count: number }[]
  selectedId: string | null
}

const CHIP_CLASSES =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"

/** Фильтр руководителя по менеджерам. Состояние хранится в адресе (?manager=), им можно поделиться. */
export function ManagerFilter({ managers, selectedId }: ManagerFilterProps) {
  return (
    <nav aria-label="Фильтр по менеджерам" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      <Link
        href={routes.focus}
        aria-current={selectedId === null ? "true" : undefined}
        className={cn(CHIP_CLASSES, selectedId === null ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground")}
      >
        Все
      </Link>
      {managers.map((manager) => {
        const isSelected = manager.id === selectedId
        return (
          <Link
            key={manager.id}
            href={`${routes.focus}?manager=${encodeURIComponent(manager.id)}`}
            aria-current={isSelected ? "true" : undefined}
            className={cn(CHIP_CLASSES, isSelected ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground")}
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
              {formatInitials(manager.name)}
            </span>
            {manager.name.split(" ")[0]}
            <span className="text-xs text-muted-foreground">{formatNumber(manager.count)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
