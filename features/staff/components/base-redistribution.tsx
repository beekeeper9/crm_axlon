"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LoaderCircle, Send } from "lucide-react"

import { ListPanel } from "@/components/shared/list-panel"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { leadRoute, prospectRoute, routes } from "@/config/routes"
import { reassignRecordsAction, type ReassignResult } from "@/features/staff/actions"
import type { FormerCustomer, FormerDeal, FormerLead, RecordKind } from "@/features/staff/api/staff-profile"
import { formatDayMonth, formatDecimalMoney, formatNumber } from "@/lib/format"

type Recipient = { userId: string; name: string; department: string | null }

type BaseRedistributionProps = {
  formerUserId: string
  isDismissed: boolean
  leads: readonly FormerLead[]
  customers: readonly FormerCustomer[]
  deals: readonly FormerDeal[]
  recipients: readonly Recipient[]
}

const DEAL_STATUS = { open: { label: "В работе", tone: "info" }, won: { label: "Выиграна", tone: "success" }, lost: { label: "Проиграна", tone: "neutral" } } as const

/**
 * База сотрудника и её передача: выбрать отдельные лиды, клиентов, сделки или всю базу вида
 * и назначить действующему сотруднику. Каждая передача сохраняется на backend с аудитом —
 * кто владел раньше, видно в истории записи.
 */
export function BaseRedistribution({ formerUserId, isDismissed, leads, customers, deals, recipients }: BaseRedistributionProps) {
  return (
    <div className="space-y-6">
      <RecordSection
        kind="lead"
        title="Лиды"
        formerUserId={formerUserId}
        canTransfer={isDismissed}
        recipients={recipients}
        rows={leads.map((lead) => ({
          id: lead.id,
          href: prospectRoute(lead.id),
          title: lead.name,
          meta: [lead.phone, lead.email, lead.status].filter(Boolean).join(" · "),
          date: lead.createdAt,
        }))}
      />
      <RecordSection
        kind="customer"
        title="Клиенты"
        formerUserId={formerUserId}
        canTransfer={isDismissed}
        recipients={recipients}
        rows={customers.map((customer) => ({
          id: customer.id,
          href: `${routes.clientBase}?client=${encodeURIComponent(customer.id)}`,
          title: customer.name,
          meta: [customer.phone, customer.email, customer.archivedAt ? "в архиве" : null].filter(Boolean).join(" · "),
          date: null,
        }))}
      />
      <RecordSection
        kind="deal"
        title="Сделки"
        allLabel="Передать все сделки в работе"
        formerUserId={formerUserId}
        canTransfer={isDismissed}
        recipients={recipients}
        rows={deals.map((deal) => ({
          id: deal.id,
          href: leadRoute(deal.id),
          title: deal.title,
          meta: formatDecimalMoney(deal.amount, deal.currency),
          date: deal.createdAt,
          badge: DEAL_STATUS[deal.status],
          // Закрытая сделка — история; передаются сделки в работе
          selectable: deal.status === "open",
        }))}
      />
    </div>
  )
}

type Row = {
  id: string
  href: string
  title: string
  meta: string
  date: string | null
  badge?: { label: string; tone: "info" | "success" | "neutral" }
  selectable?: boolean
}

function RecordSection({
  kind,
  title,
  allLabel = "Передать всю базу",
  formerUserId,
  canTransfer,
  recipients,
  rows,
}: {
  kind: RecordKind
  title: string
  allLabel?: string
  formerUserId: string
  canTransfer: boolean
  recipients: readonly Recipient[]
  rows: readonly Row[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [owner, setOwner] = useState<string | null>(null)
  const [result, setResult] = useState<ReassignResult | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const selectable = rows.filter((row) => row.selectable !== false)

  function transfer(ids: readonly string[] | "all") {
    if (!owner) return setFailure("Выберите сотрудника, которому передать записи.")
    startTransition(async () => {
      const outcome = await reassignRecordsAction(formerUserId, kind, ids, owner)
      if (outcome.ok) {
        setResult(outcome.data)
        setFailure(outcome.data.firstError)
        setSelected(new Set())
        router.refresh()
      } else setFailure(outcome.message)
    })
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section aria-labelledby={`base-${kind}`} className="space-y-2">
      <h2 id={`base-${kind}`} className="text-base font-semibold">
        {title} · {formatNumber(rows.length)}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет.</p>
      ) : (
        <>
          {canTransfer && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Передать:</span>
              <Select items={recipients.map((r) => ({ value: r.userId, label: r.name }))} value={owner} onValueChange={setOwner}>
                <SelectTrigger className="h-8 w-60" aria-label={`Кому передать: ${title.toLowerCase()}`}>
                  <SelectValue placeholder={recipients.length ? "Выберите сотрудника" : "Нет действующих сотрудников"} />
                </SelectTrigger>
                <SelectContent>
                  {recipients.map((recipient) => (
                    <SelectItem key={recipient.userId} value={recipient.userId}>
                      {recipient.name}
                      {recipient.department && ` · ${recipient.department}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={isPending || selected.size === 0 || !owner} onClick={() => transfer([...selected])}>
                {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <Send data-icon="inline-start" aria-hidden />}
                Выбранные ({formatNumber(selected.size)})
              </Button>
              <Button size="sm" variant="outline" disabled={isPending || selectable.length === 0 || !owner} onClick={() => transfer("all")}>
                {allLabel}
              </Button>
            </div>
          )}
          {result && (
            <p role="status" className="text-sm">
              Передано {formatNumber(result.moved)}
              {result.failed > 0 && <span className="text-destructive">, не удалось {formatNumber(result.failed)}</span>}.
            </p>
          )}
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <ListPanel>
            <ul className="max-h-96 divide-y overflow-y-auto text-sm">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-4 py-2">
                  {canTransfer && (
                    <input
                      type="checkbox"
                      className="size-4 accent-(--primary)"
                      checked={selected.has(row.id)}
                      disabled={row.selectable === false}
                      onChange={() => toggle(row.id)}
                      aria-label={`Выбрать: ${row.title}`}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <Link href={row.href} className="font-medium hover:text-primary hover:underline">
                      {row.title}
                    </Link>
                    {row.meta && <span className="block truncate text-meta text-muted-foreground">{row.meta}</span>}
                  </span>
                  {row.badge && <StatusBadge tone={row.badge.tone}>{row.badge.label}</StatusBadge>}
                  {row.date && <span className="shrink-0 text-meta text-muted-foreground">{formatDayMonth(row.date)}</span>}
                </li>
              ))}
            </ul>
          </ListPanel>
        </>
      )}
    </section>
  )
}
