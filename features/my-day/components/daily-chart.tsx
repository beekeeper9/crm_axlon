import type { MyMonth } from "@/features/my-day/schemas"
import { formatCompactNumber, formatDayMonth } from "@/lib/format"

const WIDTH = 640
const HEIGHT = 220
const PAD = { top: 10, right: 8, bottom: 22, left: 44 }
const TICKS = 4
const DAY_LABELS = [1, 8, 15, 22, 29]

type Series = "turnover" | "sales"

/**
 * График «По дням» без библиотеки: сплошная ступенька — накопительно, пунктир — сколько положено
 * к дню по рабочим дням (только для оборота), столбики — за день. Числа приходят от backend.
 */
export function DailyChart({ daily, series }: { daily: MyMonth["daily"]; series: Series }) {
  const values = daily.map((day) =>
    series === "turnover"
      ? { total: day.cumulative === null ? null : Number(day.cumulative), plan: Number(day.plan), day: day.turnover === null ? null : Number(day.turnover) }
      : { total: null as number | null, plan: null as number | null, day: day.sales }
  )
  if (series === "sales") {
    let sum = 0
    values.forEach((value) => {
      if (value.day !== null) {
        sum += value.day
        value.total = sum
      }
    })
  }

  const max = Math.max(1, ...values.flatMap((value) => [value.total ?? 0, value.plan ?? 0]))
  const innerWidth = WIDTH - PAD.left - PAD.right
  const innerHeight = HEIGHT - PAD.top - PAD.bottom
  const step = innerWidth / daily.length
  const x = (index: number) => PAD.left + step * index
  const y = (value: number) => PAD.top + innerHeight - (value / max) * innerHeight
  const dailyMax = Math.max(1, ...values.map((value) => value.day ?? 0))

  const stepLine = (pick: (index: number) => number | null) => {
    const points: string[] = []
    values.forEach((_, index) => {
      const value = pick(index)
      if (value === null) return
      points.push(`${points.length === 0 ? "M" : "L"}${x(index)},${y(value)}`, `L${x(index + 1)},${y(value)}`)
    })
    return points.join(" ")
  }

  const label = series === "turnover" ? "Оборот по дням: накопительно и план к дню" : "Продажи по дням: накопительно и за день"

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={label}>
      {Array.from({ length: TICKS + 1 }, (_, index) => {
        const value = (max / TICKS) * index
        return (
          <g key={index}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} className="stroke-border" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(value) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {series === "turnover" ? formatCompactNumber(value) : Math.round(value)}
            </text>
          </g>
        )
      })}
      {values.map((value, index) =>
        value.day ? (
          <rect
            key={index}
            x={x(index) + step * 0.2}
            width={step * 0.6}
            y={PAD.top + innerHeight - (value.day / dailyMax) * innerHeight * 0.35}
            height={(value.day / dailyMax) * innerHeight * 0.35}
            className="fill-primary/35"
          >
            <title>{`${formatDayMonth(daily[index].date)}: ${series === "turnover" ? formatCompactNumber(value.day) : value.day}`}</title>
          </rect>
        ) : null
      )}
      {series === "turnover" && (
        <path d={stepLine((index) => values[index].plan)} fill="none" className="stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="4 4" />
      )}
      <path d={stepLine((index) => values[index].total)} fill="none" className="stroke-primary" strokeWidth={2} />
      {DAY_LABELS.filter((day) => day <= daily.length).map((day) => (
        <text key={day} x={x(day - 1) + step / 2} y={HEIGHT - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {String(day).padStart(2, "0")}
        </text>
      ))}
    </svg>
  )
}
