import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Аналитика" }

export default function AnalyticsPage() {
  return (
    <UpcomingSection
      href={routes.analytics}
      description="Отчёты по продажам и эффективности команды"
      plannedFeatures={[
        "Выполнение плана по периодам и менеджерам",
        "Конверсии и время на этапах воронки",
        "Сравнение периодов и выгрузка отчётов",
      ]}
    />
  )
}
