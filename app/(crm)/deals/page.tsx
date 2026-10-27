import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Сделки" }

export default function DealsPage() {
  return (
    <UpcomingSection
      href={routes.deals}
      description="Сделки и воронки продаж"
      plannedFeatures={[
        "Канбан-доска воронки с перетаскиванием сделок между этапами",
        "Список сделок с фильтрами по менеджеру, этапу и сумме",
        "Карточка сделки: история, задачи, звонки, следующий шаг",
      ]}
    />
  )
}
