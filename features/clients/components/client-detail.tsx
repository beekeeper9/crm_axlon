import Link from "next/link"
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react"

import { PersonAvatar } from "@/components/shared/person-avatar"
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge"
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { leadRoute } from "@/config/routes"
import type { ClientDetail } from "@/features/clients/schemas"
import type { StageKind } from "@/features/sales"
import { formatDateTime, formatDayMonth, formatDecimalMoney, formatNumber, pluralize } from "@/lib/format"

const STAGE_TONES: Record<StageKind, StatusTone> = { open: "info", won: "success", lost: "neutral" }

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`
}

/** Содержимое панели клиента: контакты, все сделки (переход в карточку лида) и последние события */
export function ClientDetailContent({ client }: { client: ClientDetail }) {
  return (
    <>
      <SheetHeader className="pr-10">
        <SheetTitle className="text-base">{client.name}</SheetTitle>
        <SheetDescription>
          {formatNumber(client.dealsCount)} {pluralize(client.dealsCount, ["сделка", "сделки", "сделок"])}
          {client.openDealsCount > 0 ? ` · ${formatNumber(client.openDealsCount)} в работе` : " · все закрыты"}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-6">
        <section className="space-y-1.5" aria-label="Контакты">
          {client.phones.map((phone) => (
            <a key={phone} href={telHref(phone)} className="flex items-center gap-2 text-sm tabular-nums hover:text-primary">
              <Phone className="size-3.5 text-muted-foreground" aria-hidden />
              {phone}
            </a>
          ))}
          {client.email && (
            <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
              <Mail className="size-3.5 text-muted-foreground" aria-hidden />
              {client.email}
            </a>
          )}
          {client.city && (
            <p className="flex items-center gap-2 text-sm">
              <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
              {client.city}
            </p>
          )}
          {client.manager && (
            <p className="flex items-center gap-2 pt-1 text-meta text-muted-foreground">
              <PersonAvatar name={client.manager.name} />
              Ответственный: {client.manager.name}
            </p>
          )}
        </section>

        <section className="space-y-2" aria-labelledby="client-deals">
          <h3 id="client-deals" className="text-xs font-medium text-muted-foreground">Сделки</h3>
          <ul className="divide-y rounded-lg ring-1 ring-border">
            {client.deals.map((deal) => (
              <li key={deal.id}>
                <Link href={leadRoute(deal.id)} className="group flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={STAGE_TONES[deal.stageKind]}>{deal.stageName}</StatusBadge>
                      <span className="text-xs text-muted-foreground">{deal.pipelineName}</span>
                    </div>
                    <p className="text-meta text-muted-foreground">
                      {deal.amount && deal.currency ? formatDecimalMoney(deal.amount, deal.currency) : "Без суммы"} · обновлено{" "}
                      {formatDayMonth(deal.updatedAt)}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
                  <span className="sr-only">Открыть карточку лида</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {client.recentActivity.length > 0 && (
          <section className="space-y-2" aria-labelledby="client-activity">
            <h3 id="client-activity" className="text-xs font-medium text-muted-foreground">Последние события</h3>
            <ol className="space-y-2">
              {client.recentActivity.map((item) => (
                <li key={item.id} className="text-meta">
                  <p>{item.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(item.at)}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </>
  )
}
