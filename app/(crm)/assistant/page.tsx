import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "ИИ-помощник" }

export default function AssistantPage() {
  return (
    <UpcomingSection
      href={routes.assistant}
      description="Вопросы о клиентах, сделках и правилах компании"
      plannedFeatures={[
        "Диалог с ИИ своими словами",
        "История запросов",
        "Ответы только для чтения: помощник ничего не меняет в CRM",
      ]}
    />
  )
}
