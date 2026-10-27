import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Встречи" }

export default function MeetingsPage() {
  return (
    <UpcomingSection
      href={routes.meetings}
      description="Календарь встреч с клиентами"
      plannedFeatures={[
        "Календарь встреч менеджеров",
        "Итоги встречи и привязка к сделке",
        "Напоминания о предстоящих встречах",
      ]}
    />
  )
}
