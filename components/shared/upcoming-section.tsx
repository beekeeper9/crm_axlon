import { Check, Construction } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Card } from "@/components/ui/card"
import { findNavItem } from "@/config/navigation"
import type { AppRoute } from "@/config/routes"

type UpcomingSectionProps = {
  href: AppRoute
  description: string
  /** Что предварительно планируется в разделе; состав уточняется при планировании MVP */
  plannedFeatures: readonly string[]
}

/**
 * Честная заглушка раздела: говорит, что раздел в разработке, и что в нём будет.
 * Не изображает работающую функциональность.
 */
export function UpcomingSection({ href, description, plannedFeatures }: UpcomingSectionProps) {
  const item = findNavItem(href)
  const Icon = item?.icon ?? Construction

  return (
    <div className="space-y-6">
      <PageHeader title={item?.title ?? "Раздел"} description={description} />
      <Card className="items-center px-6 py-12 text-center">
        <div className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="max-w-md space-y-1">
          <p className="font-medium">Раздел в разработке</p>
          <p className="text-sm text-muted-foreground">
            Он появится на одном из следующих этапов. Что будет в разделе:
          </p>
        </div>
        <ul className="space-y-1.5 text-left text-sm">
          {plannedFeatures.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
