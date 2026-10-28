import { z } from "zod"

/**
 * Раскладка рабочего пространства: какие виджеты показаны и какого они размера.
 * Только конфигурация — сами виджеты и их данные живут в модулях.
 * Схема проверяет конфигурацию, пришедшую из backend, перед отрисовкой.
 */

export const widgetTypeSchema = z.enum([
  "sales-kpis",
  "plan-trend",
  "attention",
  "team-performance",
  "tasks-today",
  "sales-funnel",
  // «Мой день» менеджера
  "now-strip",
  "personal-turnover",
  "earnings",
  "personal-kpis",
  "meetings-funnel",
  "daily-dynamics",
  "sales-segments",
])

/** Ширина виджета на большом экране; на узких экранах все виджеты во всю ширину */
export const widgetSizeSchema = z.enum(["third", "half", "two-thirds", "full"])

export const widgetPlacementSchema = z.object({
  id: z.string(),
  type: widgetTypeSchema,
  size: widgetSizeSchema,
})

export const workspaceLayoutSchema = z.object({
  id: z.string(),
  name: z.string(),
  widgets: z.array(widgetPlacementSchema),
})

export type WidgetType = z.infer<typeof widgetTypeSchema>
export type WidgetSize = z.infer<typeof widgetSizeSchema>
export type WidgetPlacement = z.infer<typeof widgetPlacementSchema>
export type WorkspaceLayout = z.infer<typeof workspaceLayoutSchema>
