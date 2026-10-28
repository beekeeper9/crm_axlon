import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "После встречи" }

export default function AfterMeetingPage() {
  return (
    <UpcomingSection
      href={routes.afterMeeting}
      description="Лиды после консультации — до оплаты, отказа или отложенного решения"
      plannedFeatures={[
        "Группы: требуют действия, ждут ответа, без шага, просрочено, запланировано",
        "Контекст лида, собранный ИИ, и следующий шаг",
        "Переход в карточку лида и к переписке",
      ]}
    />
  )
}
