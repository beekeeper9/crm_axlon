import { WidgetSkeleton } from "@/components/shared/widget-card"
import {
  ATTENTION_TITLE,
  AttentionWidget,
} from "@/features/dashboard/components/attention-widget"
import {
  PLAN_TREND_TITLE,
  PlanTrendWidget,
} from "@/features/dashboard/components/plan-trend-widget"
import {
  SALES_FUNNEL_TITLE,
  SalesFunnelWidget,
} from "@/features/dashboard/components/sales-funnel-widget"
import {
  SalesKpisSkeleton,
  SalesKpisWidget,
} from "@/features/dashboard/components/sales-kpis-widget"
import {
  TEAM_PERFORMANCE_TITLE,
  TeamPerformanceWidget,
} from "@/features/dashboard/components/team-performance-widget"
import { TASKS_TODAY_TITLE, TasksTodayWidget } from "@/features/tasks"
import type { WidgetType } from "@/features/workspace"
import type { Permission } from "@/lib/permissions/roles"

export type WidgetDefinition = {
  title: string
  /** Виджет показывается только ролям с этим правом */
  permission?: Permission
  component: () => Promise<React.ReactNode>
  skeleton: React.ReactNode
}

/**
 * Явный реестр виджетов: тип из конфигурации рабочего пространства → компонент.
 * Конфигурация может ссылаться только на виджеты из этого списка.
 * Главная — модуль-агрегатор, поэтому ей разрешено брать виджеты из публичного API других модулей.
 */
export const widgetRegistry: Record<WidgetType, WidgetDefinition> = {
  "sales-kpis": {
    title: "Ключевые показатели",
    component: SalesKpisWidget,
    skeleton: <SalesKpisSkeleton />,
  },
  "plan-trend": {
    title: PLAN_TREND_TITLE,
    component: PlanTrendWidget,
    skeleton: <WidgetSkeleton title={PLAN_TREND_TITLE} bodyClassName="h-80" />,
  },
  attention: {
    title: ATTENTION_TITLE,
    permission: "team.view",
    component: AttentionWidget,
    skeleton: <WidgetSkeleton title={ATTENTION_TITLE} bodyClassName="h-80" />,
  },
  "team-performance": {
    title: TEAM_PERFORMANCE_TITLE,
    permission: "team.view",
    component: TeamPerformanceWidget,
    skeleton: <WidgetSkeleton title={TEAM_PERFORMANCE_TITLE} bodyClassName="h-72" />,
  },
  "tasks-today": {
    title: TASKS_TODAY_TITLE,
    component: TasksTodayWidget,
    skeleton: <WidgetSkeleton title={TASKS_TODAY_TITLE} bodyClassName="h-72" />,
  },
  "sales-funnel": {
    title: SALES_FUNNEL_TITLE,
    component: SalesFunnelWidget,
    skeleton: <WidgetSkeleton title={SALES_FUNNEL_TITLE} bodyClassName="h-64" />,
  },
}
