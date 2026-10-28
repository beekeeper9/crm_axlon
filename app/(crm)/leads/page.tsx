import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Список" }

export default function LeadsPage() {
  return (
    <UpcomingSection
      href={routes.leads}
      description="Все лиды компании"
      plannedFeatures={[
        "Таблица лидов с поиском, фильтрами и сортировкой",
        "Воронка, этап, ответственный, оплата и последнее сообщение",
        "Переход в карточку лида",
      ]}
    />
  )
}
