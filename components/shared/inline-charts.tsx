import { formatCompactNumber, formatDayMonth } from "@/lib/format"

/**
 * Лёгкие графики без библиотеки (inline SVG). Числа приходят от backend; здесь только
 * масштаб и отрисовка. Цвета — токены темы, подписи дублируют смысл для экранного диктора.
 */

const WIDTH = 640
const PAD = { top: 10, right: 8, bottom: 22, left: 40 }

export type ChartPoint = { day: string; value: number | null }

/** Путь ломаной по точкам; пропуски (null) разрывают линию */
export function linePath(values: readonly (number | null)[], x: (index: number) => number, y: (value: number) => number): string {
  let pen = false
  return values
    .map((value, index) => {
      if (value === null) {
        pen = false
        return ""
      }
      const command = pen ? "L" : "M"
      pen = true
      return `${command}${x(index).toFixed(1)},${y(value).toFixed(1)}`
    })
    .filter(Boolean)
    .join(" ")
}

/** Подписи оси X: первый, последний и несколько дней между ними */
function dayTicks(count: number): number[] {
  if (count <= 1) return [0]
  const step = Math.max(1, Math.round((count - 1) / 4))
  const ticks: number[] = []
  for (let index = 0; index < count - 1; index += step) ticks.push(index)
  if (count - 1 - (ticks.at(-1) ?? 0) < step / 2) ticks.pop()
  ticks.push(count - 1)
  return ticks
}

type ProgressChartProps = {
  label: string
  points: readonly ChartPoint[]
  /** Цель на конец периода: пунктир от 0 до цели — «сколько положено к дню» при равномерном темпе */
  target?: number | null
  /** Всего дней в периоде (ось X); по умолчанию — число точек */
  totalDays?: number
  height?: number
  format?: (value: number) => string
}

/** Накопительный факт по дням против линейного плана */
export function ProgressChart({ label, points, target = null, totalDays, height = 180, format = formatCompactNumber }: ProgressChartProps) {
  const days = Math.max(totalDays ?? points.length, points.length, 1)
  const values = points.map((point) => point.value)
  const max = Math.max(1, target ?? 0, ...values.map((value) => value ?? 0))
  const innerWidth = WIDTH - PAD.left - PAD.right
  const innerHeight = height - PAD.top - PAD.bottom
  const x = (index: number) => PAD.left + (days === 1 ? innerWidth / 2 : (innerWidth * index) / (days - 1))
  const y = (value: number) => PAD.top + innerHeight - (value / max) * innerHeight
  const ticks = [0, max / 2, max]

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full" role="img" aria-label={label}>
      {ticks.map((value) => (
        <g key={value}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} className="stroke-border" strokeWidth={1} />
          <text x={PAD.left - 6} y={y(value) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {format(value)}
          </text>
        </g>
      ))}
      {target !== null && target > 0 && (
        <line x1={x(0)} y1={y(0)} x2={x(days - 1)} y2={y(target)} className="stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="4 4" />
      )}
      <path d={linePath(values, x, y)} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" />
      {dayTicks(points.length).map((index) => (
        <text key={index} x={x(index)} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {formatDayMonth(points[index].day)}
        </text>
      ))}
    </svg>
  )
}

export type ScorePoint = { day: string; points: number | null; grade: number | null; note: string | null }

const GRADE_FILL: Record<number, string> = {
  5: "fill-success",
  4: "fill-success/70",
  3: "fill-warning",
  2: "fill-destructive",
}

/** Оценка дня по дням: столбик 0–100, цвет — оценка; день без оценки — короткая серая метка */
export function ScoreBars({ label, points, height = 140 }: { label: string; points: readonly ScorePoint[]; height?: number }) {
  const innerWidth = WIDTH - PAD.left - PAD.right
  const innerHeight = height - PAD.top - PAD.bottom
  const step = innerWidth / Math.max(points.length, 1)
  const barWidth = Math.max(2, step * 0.7)
  const y = (value: number) => PAD.top + innerHeight - (value / 100) * innerHeight

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full" role="img" aria-label={label}>
      {[0, 60, 75, 90, 100].map((value) => (
        <g key={value}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} className="stroke-border" strokeWidth={1} strokeDasharray={value === 0 || value === 100 ? undefined : "2 3"} />
          <text x={PAD.left - 6} y={y(value) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {value}
          </text>
        </g>
      ))}
      {points.map((point, index) => {
        const left = PAD.left + step * index + (step - barWidth) / 2
        const title = `${formatDayMonth(point.day)}: ${point.points === null ? point.note ?? "нет оценки" : `${point.points} баллов, оценка ${point.grade}`}`
        return point.points === null ? (
          <rect key={point.day} x={left} y={y(0) - 2} width={barWidth} height={2} className="fill-muted-foreground/40">
            <title>{title}</title>
          </rect>
        ) : (
          <rect key={point.day} x={left} y={y(point.points)} width={barWidth} height={Math.max(1, y(0) - y(point.points))} rx={1} className={GRADE_FILL[point.grade ?? 2] ?? "fill-primary"}>
            <title>{title}</title>
          </rect>
        )
      })}
      {dayTicks(points.length).map((index) => (
        <text key={index} x={PAD.left + step * index + step / 2} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {points[index] ? formatDayMonth(points[index].day) : ""}
        </text>
      ))}
    </svg>
  )
}
