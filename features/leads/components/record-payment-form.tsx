"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { submitPayment } from "@/features/payments/api/record-payment"
import { ReceiptField } from "@/features/payments/components/receipt-field"
import { companyDateOf } from "@/lib/datetime"

const KINDS = [
  { value: "prepayment", label: "Предоплата" },
  { value: "additional", label: "Доплата" },
  { value: "full", label: "Полная оплата" },
] as const

type Kind = (typeof KINDS)[number]["value"]

/**
 * Внести оплату (с чеком — без него оплата не уходит на проверку) или возврат (документ не
 * обязателен). Повторная отправка той же формы не создаёт дубль (ключ reference).
 */
export function RecordPaymentForm({ dealId, customerId, currency }: { dealId: string; customerId: string | null; currency: string | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [kind, setKind] = useState<Kind>("prepayment")
  const [paidOn, setPaidOn] = useState(() => companyDateOf(new Date().toISOString()))
  const [isRefund, setIsRefund] = useState(false)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [sentForReview, setSentForReview] = useState(false)
  const [reference, setReference] = useState(() => crypto.randomUUID())

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" aria-hidden />
          Внести оплату
        </Button>
        {sentForReview && (
          <p role="status" className="text-sm text-muted-foreground">
            Оплата отправлена на проверку.
          </p>
        )}
      </div>
    )
  }

  return (
    <form
      className="grid gap-3 rounded-xl p-4 ring-1 ring-border sm:grid-cols-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!isRefund && !receipt) {
          setFailure("Прикрепите чек: без чека оплата не уходит на проверку и не считается продажей.")
          return
        }
        startTransition(async () => {
          const result = await submitPayment({ dealId, customerId, amount, kind, paidOn, isRefund, closeSale: false, reference, receipt })
          if (result.ok) {
            setFailure(null)
            setOpen(false)
            setAmount("")
            setReceipt(null)
            setSentForReview(result.status === "pending_verification")
            setReference(crypto.randomUUID())
            router.refresh()
          } else setFailure(result.message)
        })
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="payment-amount">Сумма{currency ? `, ${currency}` : ""}</Label>
        <Input id="payment-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="15000" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="payment-kind">Вид</Label>
        <Select items={KINDS.map((k) => ({ value: k.value, label: k.label }))} value={kind} onValueChange={(value) => value && setKind(value as Kind)}>
          <SelectTrigger id="payment-kind" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="payment-date">Дата оплаты</Label>
        <Input id="payment-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" checked={isRefund} onChange={(e) => setIsRefund(e.target.checked)} className="size-4 accent-(--primary)" />
        Это возврат
      </label>
      <div className="sm:col-span-2">
        <ReceiptField file={receipt} onChange={setReceipt} optional={isRefund} />
      </div>
      {failure && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {failure}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
          Сохранить
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </form>
  )
}
