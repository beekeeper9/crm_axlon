import { CircleDollarSign } from "lucide-react"
import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { RecordPaymentForm } from "@/features/leads/components/record-payment-form"
import { dealPaymentSchema } from "@/features/sales/api/deal-mutations"
import { loadPeopleNames } from "@/features/team"
import { apiRequest } from "@/lib/api/client"
import { tryLoad } from "@/lib/api/load"
import { PAGE_LIMIT_MAX, paginatedSchema } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { formatDayMonth, formatDecimalMoney } from "@/lib/format"

const KIND_LABELS: Record<string, string> = { prepayment: "Предоплата", additional: "Доплата", full: "Полная оплата" }

async function loadPayments(dealId: string) {
  const [page, nameOf] = await Promise.all([
    apiRequest("/api/v1/payments/", {
      auth: await getRenderAuth(),
      query: { dealId, limit: PAGE_LIMIT_MAX },
      schema: paginatedSchema(dealPaymentSchema),
    }),
    loadPeopleNames(),
  ])
  return { ...page, nameOf }
}

/**
 * Оплаты сделки из реестра (`GET /payments/?deal_id`). Итоги «оплачено / осталось» здесь не
 * считаются: продажи и оборот считает backend по своим определениям (возвраты, полная оплата).
 */
export async function DealPayments({ dealId, customerId, currency, canRecord }: { dealId: string; customerId: string | null; currency: string | null; canRecord: boolean }) {
  const loaded = await tryLoad(() => loadPayments(dealId))
  if (!loaded.ok) return <ApiErrorState error={loaded.error} bare />
  const { results, count, nameOf } = loaded.data

  return (
    <div className="space-y-4">
      {results.length === 0 ? (
        <EmptyState icon={CircleDollarSign} title="Оплат по сделке нет" description="Первая оплата превращает сделку в продажу — внесите её, когда деньги получены." />
      ) : (
        <ul className="divide-y rounded-xl ring-1 ring-border">
          {results.map((payment) => (
            <li key={payment.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                {payment.isRefund ? <StatusBadge tone="danger">Возврат</StatusBadge> : <span>{KIND_LABELS[payment.kind] ?? payment.kind}</span>}
                <span className="text-meta text-muted-foreground">
                  {formatDayMonth(payment.paidOn)}
                  {payment.sellerUserId && ` · ${nameOf(payment.sellerUserId)}`}
                </span>
              </span>
              <span className="font-medium tabular-nums">
                {payment.isRefund && "−"}
                {formatDecimalMoney(payment.amount, payment.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {count > results.length && <p className="text-meta text-muted-foreground">Показаны последние {results.length} из {count}.</p>}
      {canRecord && <RecordPaymentForm dealId={dealId} customerId={customerId} currency={currency} />}
    </div>
  )
}
