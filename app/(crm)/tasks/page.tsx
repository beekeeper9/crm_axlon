import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Задачи" }

export default function TasksPage() {
  return (
    <UpcomingSection
      href={routes.tasks}
      description="Задачи менеджеров и поручения РОПа"
      plannedFeatures={[
        "Открытые, сделанные и все задачи",
        "Просроченные задачи сверху, сроки, приоритеты и ответственные",
        "Постановка задач менеджерам — для РОПа",
      ]}
    />
  )
}
