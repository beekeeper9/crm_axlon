import Link from "next/link"

import { MetricHint } from "@/components/shared/metric-hint"
import { METRIC_DEFINITIONS, type MetricKey } from "@/features/team-cabinet/lib/definitions"
import type { Absence, DayLevel } from "@/features/team-cabinet/schemas"
import { formatDayMonth, formatDecimal, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const LEVEL_META: Record<DayLevel, { label: string; dot: string }> = {
  green: { label: "В порядке", dot: "bg-success" },
  yellow: { label: "Есть хвосты", dot: "bg-warning" },
  red: { label: "Нужно вмешаться", dot: "bg-destructive" },
}

/** Светофор: цвет дублируется текстом для экранного диктора и подсказкой */
export function LevelDot({ level, className }: { level: DayLevel; className?: string }) {
  return (
    <span className={cn("inline-flex size-2.5 shrink-0 rounded-full", LEVEL_META[level].dot, className)} title={LEVEL_META[level].label}>
      <span className="sr-only">{LEVEL_META[level].label}</span>
    </span>
  )
}

export function AbsenceLabel({ absence }: { absence: Absence }) {
  return (
    <span className="text-xs text-muted-foreground">
      {absence.label}
      {absence.until && ` до ${formatDayMonth(absence.until)}`}
    </span>
  )
}

type NumLinkProps = {
  value: number | null
  href?: string
  /** Ненулевое значение — проблема: подсвечиваем */
  tone?: "default" | "warning" | "danger"
  format?: "int" | "decimal"
}

/** Число в таблице кабинета: ненулевое ведёт на экран с фильтром, ноль — спокойный */
export function NumLink({ value, href, tone = "default", format = "int" }: NumLinkProps) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  const text = format === "decimal" ? formatDecimal(value) : formatNumber(value)
  if (value === 0) return <span className="text-muted-foreground/70">0</span>
  const className = cn(
    "tabular-nums",
    tone === "danger" && "font-semibold text-destructive",
    tone === "warning" && "font-semibold text-warning"
  )
  return href ? (
    <Link href={href} className={cn(className, "rounded underline-offset-2 hover:underline")}>
      {text}
    </Link>
  ) : (
    <span className={className}>{text}</span>
  )
}

/** Заголовок колонки или показателя с определением из книги метрик */
export function MetricLabel({ metric, children }: { metric: MetricKey; children?: React.ReactNode }) {
  const definition: { label: string; definition: string; isOpenQuestion?: boolean } = METRIC_DEFINITIONS[metric]
  return (
    <span className="inline-flex items-center gap-1">
      {children ?? definition.label}
      <MetricHint label={definition.label} definition={definition.definition} isOpenQuestion={definition.isOpenQuestion ?? false} />
    </span>
  )
}

/** Секция страницы: заголовок, пояснение и содержимое — без лишней рамки вокруг */
export function CabinetSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section aria-labelledby={id} className={cn("space-y-2.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="space-y-0.5">
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
          {description && <p className="text-meta text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
