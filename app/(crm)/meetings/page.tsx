import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Встречи" }

export default function MeetingsPage() {
  return (
    <UpcomingSection
      href={routes.meetings}
      description="Встречи с клиентами по дням"
      plannedFeatures={[
        "Встречи за вчера, сегодня, завтра, неделю и выбранный период",
        "Статус встречи, ответственный, напоминания и примечания",
        "Фильтр «Проводит» и «Назначил(а)»",
      ]}
    />
  )
}
