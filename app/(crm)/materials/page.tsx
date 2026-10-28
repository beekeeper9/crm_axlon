import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Материалы" }

export default function MaterialsPage() {
  return (
    <UpcomingSection
      href={routes.materials}
      description="Инструкции, скрипты и материалы по продажам"
      plannedFeatures={[
        "Поиск по всем материалам и категории",
        "Быстрые ссылки «Под рукой»",
        "Программа адаптации и инструкции по работе в CRM",
      ]}
    />
  )
}
