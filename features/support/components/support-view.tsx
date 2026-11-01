import { Inbox } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { isMockDataSource } from "@/config/env"
import { TICKET_KIND_LABELS, TICKET_STATUS_META } from "@/features/platform/labels"
import { listMyTickets } from "@/features/support/api"
import { SupportForm } from "@/features/support/components/support-form"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { formatDateTime } from "@/lib/format"

/** Вопросы, проблемы и отзывы сотрудника — администратору платформы. Видны только свои обращения */
export async function SupportView() {
  return (
    <div className="space-y-5">
      <PageHeader title="Поддержка" description="Вопрос, проблема или предложение — команде платформы CRM" />
      {isMockDataSource ? (
        <ListPanel>
          <EmptyState icon={Inbox} title="Обращения работают только с сервером" description="В демо-режиме обращения не отправляются." />
        </ListPanel>
      ) : (
        <>
          <section className="rounded-xl bg-card p-5 ring-1 ring-border">
            <SupportForm />
          </section>
          <MyTickets />
        </>
      )}
    </div>
  )
}

async function MyTickets() {
  const loaded = await tryLoad(async () => listMyTickets(await getRenderAuth()))
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  if (loaded.data.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Мои обращения</h2>
      <ListPanel>
        <ul className="divide-y">
          {loaded.data.map((ticket) => (
            <li key={ticket.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{ticket.subject}</p>
                <p className="text-meta text-muted-foreground">
                  {TICKET_KIND_LABELS[ticket.kind]} · {formatDateTime(ticket.createdAt)}
                </p>
              </div>
              <StatusBadge tone={TICKET_STATUS_META[ticket.status].tone}>{TICKET_STATUS_META[ticket.status].label}</StatusBadge>
            </li>
          ))}
        </ul>
      </ListPanel>
    </section>
  )
}
