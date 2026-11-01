import { SegmentedLinks } from "@/components/shared/segmented-links"
import { routes } from "@/config/routes"

export type PlatformSection = "overview" | "companies" | "errors" | "tickets"

const SECTIONS: readonly { key: PlatformSection; label: string; href: string }[] = [
  { key: "overview", label: "Обзор", href: routes.platform },
  { key: "companies", label: "Компании", href: routes.platformCompanies },
  { key: "errors", label: "Ошибки", href: routes.platformErrors },
  { key: "tickets", label: "Обращения", href: routes.platformTickets },
]

/** Разделы панели администратора платформы */
export function PlatformNav({ active }: { active: PlatformSection }) {
  return (
    <div className="border-b">
      <SegmentedLinks label="Разделы платформы" items={SECTIONS.map((item) => ({ ...item, isActive: item.key === active }))} />
    </div>
  )
}
