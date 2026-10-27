"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { RevenueTrend } from "@/features/dashboard/schemas"
import { formatCompactNumber, formatDayMonth, formatMoney } from "@/lib/format"

const chartConfig = {
  actual: { label: "Факт", color: "var(--chart-1)" },
  plan: { label: "План", color: "var(--chart-5)" },
} satisfies ChartConfig

type RevenueTrendChartProps = {
  points: RevenueTrend["points"]
}

/** Накопительная выручка против линии плана. */
export function RevenueTrendChart({ points }: RevenueTrendChartProps) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenue-actual-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-actual)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--color-actual)" stopOpacity={0.01} />
          </linearGradient>
        </defs>
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
          width={56}
          tickFormatter={formatCompactNumber}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(_, payload) => {
                const date = payload[0]?.payload?.date
                return typeof date === "string" ? formatDayMonth(date) : null
              }}
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {name === "plan" ? chartConfig.plan.label : chartConfig.actual.label}
                  </span>
                  <span className="font-medium text-foreground">
                    {typeof value === "number" ? formatMoney(value) : "—"}
                  </span>
                </div>
              )}
            />
          }
        />
        <Area
          dataKey="plan"
          type="linear"
          stroke="var(--color-plan)"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          fill="none"
          isAnimationActive={false}
        />
        <Area
          dataKey="actual"
          type="monotone"
          stroke="var(--color-actual)"
          strokeWidth={2}
          fill="url(#revenue-actual-fill)"
          isAnimationActive={false}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  )
}
