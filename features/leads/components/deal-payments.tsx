import { CircleDollarSign } from "lucide-react"
import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { RecordPaymentForm } from "@/features/leads/components/record-payment-form"
import { listDealPayments, loadDealPaymentSummary } from "@/features/payments/api/payments-api"
import { PaymentHistory } from "@/features/payments/components/payment-history"
import { PaymentSummary } from "@/features/payments/components/payment-summary"
import { loadPeopleNames } from "@/features/team"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"

async function loadPayments(dealId: string) {
  const auth = await getRenderAuth()
  const [page, summary, nameOf] = await Promise.all([listDealPayments(auth, dealId), loadDealPaymentSummary(auth, dealId), loadPeopleNames()])
  return { ...page, summary, nameOf }
}

/**
 * Оплаты сделки: сумма, подтверждённые деньги, что на проверке и долг считает backend
 * (`GET /payments/deals/{id}/summary/`); история — `GET /payments/?deal_id` со статусом и чеком.
 */
export async function DealPayments({ dealId, customerId, currency, canRecord }: { dealId: string; customerId: string | null; currency: string | null; canRecord: boolean }) {
  const loaded = await tryLoad(() => loadPayments(dealId))
  if (!loaded.ok) return <ApiErrorState error={loaded.error} bare />
  const { results, count, summary, nameOf } = loaded.data

  return (
    <div className="space-y-4">
      <PaymentSummary summary={summary} />
      {results.length === 0 ? (
        <EmptyState
          icon={CircleDollarSign}
          title="Оплат по сделке нет"
          description="Внесите оплату с чеком, когда деньги получены: продажей она станет после проверки руководителем."
        />
      ) : (
        <PaymentHistory payments={results} nameOf={nameOf} />
      )}
      {count > results.length && <p className="text-meta text-muted-foreground">Показаны последние {results.length} из {count}.</p>}
      {canRecord && <RecordPaymentForm dealId={dealId} customerId={customerId} currency={currency} />}
    </div>
  )
}
