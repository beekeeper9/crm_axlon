import { FileText, ImageIcon, TriangleAlert } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { PAYMENT_KIND_LABELS, PAYMENT_STATUS, formatFileSize, receiptHref, type Payment } from "@/features/payments/schemas"
import { formatDateTime, formatDayMonth, formatDecimalMoney } from "@/lib/format"

type PaymentHistoryProps = {
  payments: Payment[]
  nameOf: (userId: string) => string
}

/** История оплат сделки: статус проверки, чек, кто и когда его загрузил, причина отказа */
export function PaymentHistory({ payments, nameOf }: PaymentHistoryProps) {
  return (
    <ul className="divide-y rounded-xl ring-1 ring-border">
      {payments.map((payment) => (
        <li key={payment.id} className="grid gap-1 px-4 py-2.5 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="flex flex-wrap items-center gap-2">
              {payment.isRefund ? <StatusBadge tone="danger">Возврат</StatusBadge> : <span>{PAYMENT_KIND_LABELS[payment.kind]}</span>}
              {!payment.isRefund && <StatusBadge tone={PAYMENT_STATUS[payment.status].tone}>{PAYMENT_STATUS[payment.status].label}</StatusBadge>}
              <span className="text-meta text-muted-foreground">
                {formatDayMonth(payment.paidOn)} · {nameOf(payment.sellerUserId)}
              </span>
            </span>
            <span className={payment.status === "rejected" ? "font-medium tabular-nums text-muted-foreground line-through" : "font-medium tabular-nums"}>
              {payment.isRefund && "−"}
              {formatDecimalMoney(payment.amount, payment.currency)}
            </span>
          </div>
          <PaymentReceiptLine payment={payment} nameOf={nameOf} />
          {payment.status === "rejected" && payment.rejectionReason && (
            <p className="text-meta text-destructive">Причина отказа: {payment.rejectionReason}</p>
          )}
          {payment.status === "confirmed" && payment.verifiedByUserId && !payment.isRefund && (
            <p className="text-meta text-muted-foreground">
              Подтвердил {nameOf(payment.verifiedByUserId)}
              {payment.verifiedAt && `, ${formatDateTime(payment.verifiedAt)}`}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

export function PaymentReceiptLine({ payment, nameOf }: { payment: Payment; nameOf: (userId: string) => string }) {
  const receipt = payment.receipt
  if (!receipt) {
    if (payment.isRefund) return <p className="text-meta text-muted-foreground">Документ возврата не прикреплён</p>
    return (
      <p className="flex items-center gap-1.5 text-meta text-warning">
        <TriangleAlert className="size-3.5" aria-hidden />
        Без чека: оплата внесена до обязательной проверки
      </p>
    )
  }
  const Icon = receipt.contentType === "application/pdf" ? FileText : ImageIcon
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-meta text-muted-foreground">
      <Icon className="size-3.5" aria-hidden />
      <a href={receiptHref(payment.id)} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
        {receipt.filename}
        <span className="sr-only"> (откроется в новой вкладке)</span>
      </a>
      <span>
        · {formatFileSize(receipt.size)} · загрузил {nameOf(receipt.uploadedByUserId)}, {formatDateTime(receipt.uploadedAt)}
      </span>
    </p>
  )
}
