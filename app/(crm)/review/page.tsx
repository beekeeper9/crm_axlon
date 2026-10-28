import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Разбор" }

export default function ReviewPage() {
  return (
    <UpcomingSection
      href={routes.review}
      description="Лиды, которые требуют решения или работы над ошибками"
      plannedFeatures={[
        "Очередь лидов, отправленных РОПом на разбор",
        "Выявленные проблемы и назначенные задачи",
        "Решение по лиду с комментарием",
      ]}
    />
  )
}
