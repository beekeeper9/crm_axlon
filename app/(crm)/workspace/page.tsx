import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Рабочее пространство" }

export default function WorkspacePage() {
  return (
    <UpcomingSection
      href={routes.workspace}
      description="Настройка интерфейса для отдела"
      plannedFeatures={[
        "Выбор и расстановка виджетов главной для отдела",
        "Набор разделов, доступных менеджерам",
        "Запросы менеджеров на изменения с одобрением РОПа",
      ]}
    />
  )
}
