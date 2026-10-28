"use client"

import { useMemo, useState } from "react"
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"
import { cn } from "cn"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { PersonalTurnover } from "@/features/dashboard/schemas"
import { formatCompactNumber, formatDayMonth, formatMoney, formatNumber } from "@/lib/format"

type Mode = "turnover" | "sales"

const MODES: { id: Mode; label: string }[] = [
  { id: "turnover", label: "Оборот" },
  { id: "sales", label: "Продажи" },
]

const chartConfig = {
  cumulative: { label: "Накопительно", color: "var(--chart-1)" },
  plan: { label: "По плану", color: "var(--chart-5)" },
  daily: { label: "За день", color: "var(--chart-1)" },
} satisfies ChartConfig

type ChartPoint = { date: string; cumulative: number | null; plan: number | null; daily: number | null }

function buildChartData(points: PersonalTurnover["points"], mode: Mode): ChartPoint[] {
  if (mode === "turnover") {
    return points.map((point) => ({
      date: point.date,
      cumulative: point.cumulative,
      plan: point.plan,
      daily: point.dailyTurnover,
    }))
  }
  // Накопительное число продаж считаем на клиенте: backend отдаёт продажи за день
  const result: ChartPoint[] = []
  let salesTotal = 0
  for (const point of points) {
    if (point.dailySales !== null) salesTotal += point.dailySales
    result.push({
      date: point.date,
      cumulative: point.dailySales === null ? null : salesTotal,
      plan: null,
      daily: point.dailySales,
    })
  }
  return result
}

type DailyDynamicsChartProps = {
  points: PersonalTurnover["points"]
}

export function DailyDynamicsChart({ points }: DailyDynamicsChartProps) {
  const [mode, setMode] = useState<Mode>("turnover")

  const data = useMemo(() => buildChartData(points, mode), [points, mode])

  const formatValue = mode === "turnover" ? formatMoney : formatNumber

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Показатель графика" className="inline-flex rounded-lg border p-0.5">
        {MODES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={mode === option.id}
            onClick={() => setMode(option.id)}
            className={cn(
              "rounded-md px-3 py-1 text-sm transition-colors",
              mode === option.id ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={28}
            tickFormatter={formatDayMonth}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            allowDecimals={false}
            tickFormatter={formatCompactNumber}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const date = payload[0]?.payload?.date
                  return typeof date === "string" ? formatDayMonth(date) : null
                }}
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                    </span>
                    <span className="font-medium text-foreground">
                      {typeof value === "number" ? formatValue(value) : "—"}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="daily" fill="var(--color-daily)" fillOpacity={0.35} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          {mode === "turnover" && (
            <Line dataKey="plan" type="linear" stroke="var(--color-plan)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          )}
          <Line dataKey="cumulative" type="stepAfter" stroke="var(--color-cumulative)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ChartContainer>

      <p className="text-xs text-muted-foreground">
        Сплошная линия — накопительно по дням
        {mode === "turnover" && ", пунктир — сколько положено по плану к этому дню"}, столбики — за день.
      </p>
    </div>
  )
}
