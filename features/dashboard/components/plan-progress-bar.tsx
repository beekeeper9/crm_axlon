import { cn } from "@/lib/utils"

import type { PaceStatus } from "@/features/dashboard/lib/plan-pace"
import { formatPercent } from "@/lib/format"

const FILL_CLASSES: Record<PaceStatus, string> = {
  on_track: "bg-success",
  at_risk: "bg-warning",
  behind: "bg-destructive",
}

type PlanProgressBarProps = {
  /** Выполненная доля плана (может быть больше 1) */
  ratio: number
  /** Где должны быть сейчас при равномерном темпе */
  expectedRatio: number
  status: PaceStatus
  className?: string
}

/** Шкала выполнения плана с отметкой ожидаемого темпа. */
export function PlanProgressBar({
  ratio,
  expectedRatio,
  status,
  className,
}: PlanProgressBarProps) {
  const fill = Math.min(ratio, 1) * 100
  const marker = Math.min(expectedRatio, 1) * 100

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuetext={`Выполнено ${formatPercent(ratio)}, ожидается ${formatPercent(expectedRatio)}`}
      className={cn("relative h-1.5 w-full rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full", FILL_CLASSES[status])}
        style={{ width: `${fill}%` }}
      />
      <div
        className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground/60"
        style={{ left: `${marker}%` }}
        aria-hidden
      />
    </div>
  )
}
