import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Продажи" }

export default function SalesPage() {
  return (
    <UpcomingSection
      href={routes.sales}
      description="Воронки продаж и сделки"
      plannedFeatures={[
        "Переключение между воронками, например «Новые заявки» и «Продажи»",
        "Этапы воронки с карточками сделок, поиском и фильтром по менеджерам",
        "Перенос сделки между этапами в пределах прав",
        "Настройка воронок и этапов для компании",
      ]}
    />
  )
}
