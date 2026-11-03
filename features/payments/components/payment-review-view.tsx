import { ReceiptText } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { listPaymentsForReview } from "@/features/payments/api/payments-api"
import { PaymentReviewQueue } from "@/features/payments/components/payment-review-queue"
import { loadPeopleNames } from "@/features/team"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { pluralize } from "@/lib/format"

async function loadQueue() {
  const [page, nameOf] = await Promise.all([listPaymentsForReview(await getRenderAuth()), loadPeopleNames()])
  const ids = new Set(page.results.flatMap((p) => [p.sellerUserId, p.receipt?.uploadedByUserId].filter((id): id is string => Boolean(id))))
  return { page, names: Object.fromEntries([...ids].map((id) => [id, nameOf(id)])) }
}

/** Очередь оплат на проверку: РОП видит свой отдел, директор — всю компанию (решает backend) */
export async function PaymentReviewView() {
  const loaded = await tryLoad(loadQueue)
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const { page, names } = loaded.data
  if (page.results.length === 0) {
    return <EmptyState icon={ReceiptText} title="Все оплаты проверены" description="Новые оплаты с чеками появятся здесь, как только менеджеры их отправят." />
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {page.count} {pluralize(page.count, ["оплата ждёт", "оплаты ждут", "оплат ждут"])} проверки. В продажи, KPI и план оплата попадает только после подтверждения.
      </p>
      <PaymentReviewQueue payments={page.results} names={names} />
      {page.count > page.results.length && <p className="text-meta text-muted-foreground">Показаны {page.results.length} из {page.count}: проверьте эти, и появятся следующие.</p>}
    </div>
  )
}
