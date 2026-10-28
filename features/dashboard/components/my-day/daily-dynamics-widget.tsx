import { WidgetCard } from "@/components/shared/widget-card"
import { dashboardRepository } from "@/features/dashboard/api/dashboard-repository"
import { DailyDynamicsChart } from "@/features/dashboard/components/my-day/daily-dynamics-chart"

export const DAILY_DYNAMICS_TITLE = "По дням"

export async function DailyDynamicsWidget() {
  const { period, points } = await dashboardRepository.getPersonalTurnover()

  return (
    <WidgetCard title={DAILY_DYNAMICS_TITLE} description={period.label}>
      <DailyDynamicsChart points={points} />
    </WidgetCard>
  )
}
