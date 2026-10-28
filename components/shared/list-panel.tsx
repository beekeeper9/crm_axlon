import { cn } from "@/lib/utils"

import { formatNumber } from "@/lib/format"

/**
 * Рабочий список: одна панель, внутри группы с тонким заголовком.
 * Вместо отдельной карточки на каждую группу — меньше рамок, глаз идёт по строкам.
 */
export function ListPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-xl bg-card ring-1 ring-border", className)}>{children}</div>
}

type ListGroupProps = {
  id: string
  title: string
  count?: number
  tone?: "default" | "danger" | "warning"
  children: React.ReactNode
}

const TONE_CLASSES = { default: "text-muted-foreground", danger: "text-destructive", warning: "text-warning" } as const

export function ListGroup({ id, title, count, tone = "default", children }: ListGroupProps) {
  const headingId = `list-group-${id}`
  return (
    <section aria-labelledby={headingId} className="border-t first:border-t-0">
      <h2
        id={headingId}
        className="flex items-center gap-2 bg-muted/35 px-3 py-1.5 text-xs font-medium"
      >
        <span className={cn("first-letter:uppercase", TONE_CLASSES[tone])}>{title}</span>
        {count !== undefined && <span className="text-muted-foreground tabular-nums">{formatNumber(count)}</span>}
      </h2>
      <ul className="divide-y">{children}</ul>
    </section>
  )
}
