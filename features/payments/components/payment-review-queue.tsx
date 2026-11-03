"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ExternalLink, FileText, LoaderCircle, X } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { leadRoute } from "@/config/routes"
import { confirmPaymentAction, rejectPaymentAction } from "@/features/payments/actions"
import { PAYMENT_KIND_LABELS, formatFileSize, receiptHref, type Payment } from "@/features/payments/schemas"
import { formatDateTime, formatDayMonth, formatDecimalMoney } from "@/lib/format"

type PaymentReviewQueueProps = {
  payments: Payment[]
  /** Имена сотрудников по id (собраны на сервере) */
  names: Record<string, string>
}

/** «Проверка оплат»: чек рядом с суммой, подтвердить или отклонить с причиной */
export function PaymentReviewQueue({ payments, names }: PaymentReviewQueueProps) {
  const nameOf = (userId: string) => names[userId] ?? "Сотрудник"
  return (
    <ul className="space-y-3">
      {payments.map((payment) => (
        <li key={payment.id}>
          <ReviewCard payment={payment} nameOf={nameOf} />
        </li>
      ))}
    </ul>
  )
}

function ReviewCard({ payment, nameOf }: { payment: Payment; nameOf: (userId: string) => string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const receipt = payment.receipt
  const isImage = receipt !== null && receipt.contentType.startsWith("image/") && receipt.contentType !== "image/heic"

  function act(action: () => ReturnType<typeof confirmPaymentAction>) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        setFailure(null)
        router.refresh()
      } else setFailure(result.message)
    })
  }

  return (
    <article className="grid gap-4 rounded-xl p-4 ring-1 ring-border md:grid-cols-[1fr_220px]">
      <div className="grid content-start gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold tabular-nums">{formatDecimalMoney(payment.amount, payment.currency)}</span>
          <StatusBadge tone="info">{PAYMENT_KIND_LABELS[payment.kind]}</StatusBadge>
          {payment.closeSale && <StatusBadge tone="warning">Закрывает продажу</StatusBadge>}
        </div>
        {payment.deal ? (
          <p>
            <Link href={leadRoute(payment.deal.id)} className="font-medium text-primary underline-offset-2 hover:underline">
              {payment.deal.title}
            </Link>
            <span className="text-muted-foreground"> · сделка на {formatDecimalMoney(payment.deal.amount, payment.deal.currency)}</span>
          </p>
        ) : (
          <p className="text-muted-foreground">Оплата без сделки</p>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-meta">
          <dt className="text-muted-foreground">Менеджер</dt>
          <dd>{nameOf(payment.sellerUserId)}</dd>
          <dt className="text-muted-foreground">Дата оплаты</dt>
          <dd>{formatDayMonth(payment.paidOn)}</dd>
          {receipt && (
            <>
              <dt className="text-muted-foreground">Чек загружен</dt>
              <dd>
                {nameOf(receipt.uploadedByUserId)}, {formatDateTime(receipt.uploadedAt)}
              </dd>
            </>
          )}
        </dl>
        {rejecting && (
          <div className="grid gap-1.5">
            <Label htmlFor={`reject-${payment.id}`}>Причина отказа — её увидит менеджер</Label>
            <Textarea id={`reject-${payment.id}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} placeholder="Например: сумма в чеке не совпадает" />
          </div>
        )}
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        {payment.canVerify ? (
          <div className="flex flex-wrap gap-2">
            {rejecting ? (
              <>
                <Button size="sm" variant="destructive" disabled={isPending} onClick={() => act(() => rejectPaymentAction(payment.id, reason))}>
                  {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
                  Отклонить оплату
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                  Отмена
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" disabled={isPending || !receipt} onClick={() => act(() => confirmPaymentAction(payment.id))}>
                  {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <Check data-icon="inline-start" aria-hidden />}
                  Подтвердить
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
                  <X data-icon="inline-start" aria-hidden />
                  Отклонить
                </Button>
              </>
            )}
          </div>
        ) : (
          <p className="text-meta text-muted-foreground">Эту оплату подтверждает другой руководитель: свою оплату проверить нельзя.</p>
        )}
      </div>
      <ReceiptPreview payment={payment} isImage={isImage} />
    </article>
  )
}

function ReceiptPreview({ payment, isImage }: { payment: Payment; isImage: boolean }) {
  const receipt = payment.receipt
  if (!receipt) {
    return <div className="grid place-items-center rounded-lg bg-muted p-4 text-center text-meta text-warning">Чек не прикреплён</div>
  }
  const href = receiptHref(payment.id)
  return (
    <div className="grid content-start gap-1.5">
      <a href={href} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg bg-muted ring-1 ring-border hover:ring-primary">
        {isImage ? (
          // Превью чека: картинка через BFF, без оптимизации next/image (приватный файл)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={href} alt={`Чек: ${receipt.filename}`} className="h-48 w-full object-contain" />
        ) : (
          <span className="grid h-48 place-items-center gap-1 text-muted-foreground">
            <FileText className="size-8" aria-hidden />
            <span className="text-meta">Открыть {receipt.contentType === "application/pdf" ? "PDF" : "файл"}</span>
          </span>
        )}
      </a>
      <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-meta text-primary underline-offset-2 hover:underline">
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{receipt.filename}</span>
        <span className="shrink-0 text-muted-foreground">· {formatFileSize(receipt.size)}</span>
      </a>
    </div>
  )
}
