import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Отчёты дня" }

export default function DailyReportsPage() {
  return (
    <UpcomingSection
      href={routes.dailyReports}
      description="Ежедневные итоги и план по менеджерам"
      plannedFeatures={[
        "Список дней с ключевыми цифрами",
        "Подробный отчёт: встречи, звонки, задачи, оплаты",
        "Главные выводы и что поправить завтра",
      ]}
    />
  )
}
