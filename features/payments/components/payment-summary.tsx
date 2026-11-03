import { TriangleAlert } from "lucide-react"

import type { DealPaymentSummary } from "@/features/payments/schemas"
import { formatDecimalMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Деньги сделки, посчитанные backend: в зачёт идут только подтверждённые оплаты */
export function PaymentSummary({ summary }: { summary: DealPaymentSummary }) {
  const money = (amount: string) => formatDecimalMoney(amount, summary.currency)
  const items = [
    { label: "Сумма сделки", value: money(summary.dealAmount) },
    { label: "Получено (подтверждено)", value: money(summary.confirmedReceived), className: "text-success" },
    { label: "На проверке", value: money(summary.pendingAmount), className: Number(summary.pendingAmount) > 0 ? "text-warning" : undefined },
    { label: "Долг клиента", value: money(summary.debt), className: Number(summary.debt) > 0 ? "text-warning" : undefined },
  ]
  return (
    <div className="space-y-2">
      <dl className="grid gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg px-3 py-2.5 ring-1 ring-border">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className={cn("text-lg font-semibold tabular-nums", item.className)}>{item.value}</dd>
          </div>
        ))}
      </dl>
      {Number(summary.refunded) > 0 && <p className="text-meta text-muted-foreground">Возвраты: {money(summary.refunded)} — уже вычтены из полученного.</p>}
      {summary.pendingCount > 0 && (
        <p className="flex items-center gap-1.5 text-meta text-warning">
          <TriangleAlert className="size-3.5" aria-hidden />
          Оплата на проверке у руководителя: в продажи и план она попадёт после подтверждения.
        </p>
      )}
      {summary.otherCurrencies.length > 0 && (
        <p className="text-meta text-muted-foreground">Оплаты в {summary.otherCurrencies.join(", ")} в итоги не входят: сделка ведётся в {summary.currency}.</p>
      )}
    </div>
  )
}
