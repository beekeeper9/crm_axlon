import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

import { formatPointsDelta, formatSignedPercent } from "@/lib/format"

type TrendIndicatorProps = {
  current: number
  previous: number
  /**
   * relative — относительное изменение (+8,6 %), для сумм и количеств;
   * points — разница в процентных пунктах, для долей (конверсия).
   */
  mode?: "relative" | "points"
  /** Для показателей, где рост — это плохо (например, просрочки) */
  higherIsBetter?: boolean
}

export function TrendIndicator({
  current,
  previous,
  mode = "relative",
  higherIsBetter = true,
}: TrendIndicatorProps) {
  const delta = mode === "points" ? current - previous : previous === 0 ? 0 : (current - previous) / previous
  const label = mode === "points" ? formatPointsDelta(delta) : formatSignedPercent(delta)

  // Изменения меньше 0,05 % считаем отсутствием изменений
  const direction = Math.abs(delta) < 0.0005 ? "flat" : delta > 0 ? "up" : "down"
  const isGood = direction === "flat" ? null : (direction === "up") === higherIsBetter
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isGood === true && "text-success",
        isGood === false && "text-destructive",
        isGood === null && "text-muted-foreground"
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  )
}
