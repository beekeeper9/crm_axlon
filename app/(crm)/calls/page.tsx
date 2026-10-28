import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Звонки" }

export default function CallsPage() {
  return (
    <UpcomingSection
      href={routes.calls}
      description="История звонков, записи и анализ разговоров"
      plannedFeatures={[
        "Журнал звонков с фильтрами по периоду и типу",
        "Запись, транскрипция и итог разговора, подготовленный ИИ",
        "Оценка качества звонка по 5-балльной шкале — только для РОПа",
      ]}
    />
  )
}
