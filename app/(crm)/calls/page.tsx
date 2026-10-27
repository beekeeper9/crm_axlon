import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Звонки" }

export default function CallsPage() {
  return (
    <UpcomingSection
      href={routes.calls}
      description="Журнал звонков и их результаты"
      plannedFeatures={[
        "Журнал входящих и исходящих звонков",
        "Результат звонка и следующий шаг",
        "Статистика звонков по менеджерам",
      ]}
    />
  )
}
