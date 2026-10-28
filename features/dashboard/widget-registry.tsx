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
import {
  DAILY_DYNAMICS_TITLE,
  DailyDynamicsWidget,
} from "@/features/dashboard/components/my-day/daily-dynamics-widget"
import { EARNINGS_TITLE, EarningsWidget } from "@/features/dashboard/components/my-day/earnings-widget"
import {
  MEETINGS_FUNNEL_TITLE,
  MeetingsFunnelWidget,
} from "@/features/dashboard/components/my-day/meetings-funnel-widget"
import { NowStripSkeleton, NowStripWidget } from "@/features/dashboard/components/my-day/now-strip-widget"
import {
  PersonalKpisSkeleton,
  PersonalKpisWidget,
} from "@/features/dashboard/components/my-day/personal-kpis-widget"
import {
  PERSONAL_TURNOVER_TITLE,
  PersonalTurnoverWidget,
} from "@/features/dashboard/components/my-day/personal-turnover-widget"
import { SalesSegmentsWidget } from "@/features/dashboard/components/my-day/sales-segments-widget"
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
  "now-strip": {
    title: "Сейчас",
    component: NowStripWidget,
    skeleton: <NowStripSkeleton />,
  },
  "personal-turnover": {
    title: PERSONAL_TURNOVER_TITLE,
    component: PersonalTurnoverWidget,
    skeleton: <WidgetSkeleton title={PERSONAL_TURNOVER_TITLE} bodyClassName="h-52" />,
  },
  earnings: {
    title: EARNINGS_TITLE,
    component: EarningsWidget,
    skeleton: <WidgetSkeleton title={EARNINGS_TITLE} bodyClassName="h-52" />,
  },
  "personal-kpis": {
    title: "Личные показатели",
    component: PersonalKpisWidget,
    skeleton: <PersonalKpisSkeleton />,
  },
  "meetings-funnel": {
    title: MEETINGS_FUNNEL_TITLE,
    component: MeetingsFunnelWidget,
    skeleton: <WidgetSkeleton title={MEETINGS_FUNNEL_TITLE} bodyClassName="h-48" />,
  },
  "daily-dynamics": {
    title: DAILY_DYNAMICS_TITLE,
    component: DailyDynamicsWidget,
    skeleton: <WidgetSkeleton title={DAILY_DYNAMICS_TITLE} bodyClassName="h-72" />,
  },
  "sales-segments": {
    title: "Направления",
    component: SalesSegmentsWidget,
    skeleton: <WidgetSkeleton title="Направления" bodyClassName="h-40" />,
  },
}
