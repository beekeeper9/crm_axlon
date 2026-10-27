import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Задачи" }

export default function TasksPage() {
  return (
    <UpcomingSection
      href={routes.tasks}
      description="Задачи и напоминания команды"
      plannedFeatures={[
        "Мои задачи и задачи команды на день и неделю",
        "Контроль просроченных задач",
        "Создание задачи из сделки или контакта",
      ]}
    />
  )
}
