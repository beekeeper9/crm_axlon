import type { Metadata } from "next"

import { UpcomingSection } from "@/components/shared/upcoming-section"
import { routes } from "@/config/routes"

export const metadata: Metadata = { title: "Контакты" }

export default function ContactsPage() {
  return (
    <UpcomingSection
      href={routes.contacts}
      description="Клиенты, компании и история взаимодействия"
      plannedFeatures={[
        "База контактов и компаний с поиском",
        "История взаимодействия с клиентом в одной ленте",
        "Связь контактов со сделками",
      ]}
    />
  )
}
