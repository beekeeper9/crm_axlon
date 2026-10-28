import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "База клиентов" }

export default function ClientBasePage() {
  return (
    <UpcomingSection
      href={routes.clientBase}
      description="Поиск по всей истории клиентов"
      plannedFeatures={[
        "Поиск по имени или телефону",
        "Закрытые и архивные сделки клиента",
        "Переход к открытым сделкам того же человека",
      ]}
    />
  )
}
