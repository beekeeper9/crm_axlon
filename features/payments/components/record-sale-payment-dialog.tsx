"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CircleCheck, LoaderCircle, Receipt } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { submitPayment } from "@/features/payments/api/record-payment"
import { ReceiptField } from "@/features/payments/components/receipt-field"
import { receiptProblem } from "@/features/payments/schemas"
import { companyDateOf } from "@/lib/datetime"
import { cn } from "@/lib/utils"

const SALE_KINDS = [
  { value: "prepayment", label: "Предоплата" },
  { value: "full", label: "Полная оплата" },
] as const

type SaleKind = (typeof SALE_KINDS)[number]["value"]

type RecordSalePaymentDialogProps = {
  dealId: string
  customerId?: string | null
  currency?: string | null
  /** Управляемое окно (например, при переносе сделки на «Продажа»); без него — своя кнопка */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Оплата отправлена на проверку */
  onSubmitted?: () => void
}

/**
 * Перевод сделки на системный этап «Продажа»: тип оплаты, сумма и чек. Сделка становится
 * успешной только после того, как РОП или директор подтвердит оплату по чеку.
 */
export function RecordSalePaymentDialog({ dealId, customerId = null, currency = null, open, onOpenChange, onSubmitted }: RecordSalePaymentDialogProps) {
  const router = useRouter()
  const [ownOpen, setOwnOpen] = useState(false)
  const isOpen = open ?? ownOpen
  const [isPending, startTransition] = useTransition()
  const [kind, setKind] = useState<SaleKind>("prepayment")
  const [amount, setAmount] = useState("")
  const [paidOn, setPaidOn] = useState(() => companyDateOf(new Date().toISOString()))
  const [receipt, setReceipt] = useState<File | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [reference, setReference] = useState(() => crypto.randomUUID())

  function setOpen(next: boolean) {
    if (open === undefined) setOwnOpen(next)
    onOpenChange?.(next)
    if (!next) {
      setFailure(null)
      if (sent) {
        setSent(false)
        setAmount("")
        setReceipt(null)
        setReference(crypto.randomUUID())
      }
    }
  }

  function submit() {
    if (!receipt) {
      setFailure("Прикрепите чек: без чека оплату нельзя проверить, и сделка не станет продажей.")
      return
    }
    const problem = receiptProblem(receipt)
    if (problem) {
      setFailure(problem)
      return
    }
    startTransition(async () => {
      const result = await submitPayment({ dealId, customerId, amount, kind, paidOn, isRefund: false, closeSale: true, reference, receipt })
      if (result.ok) {
        setFailure(null)
        setSent(true)
        onSubmitted?.()
        router.refresh()
      } else setFailure(result.message)
    })
  }

  return (
    <>
      {open === undefined && (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Receipt data-icon="inline-start" aria-hidden />
          Оплата и чек
        </Button>
      )}
      <Dialog open={isOpen} onOpenChange={(next) => setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          {sent ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CircleCheck className="size-5 text-success" aria-hidden />
                  Оплата отправлена на проверку
                </DialogTitle>
                <DialogDescription>
                  Руководитель проверит чек. Сделка станет успешной продажей и попадёт в план после подтверждения оплаты; если чек не примут, причина появится в карточке сделки.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Готово</Button>
              </DialogFooter>
            </>
          ) : (
            <form
              className="grid gap-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <DialogHeader>
                <DialogTitle>Подтвердите оплату</DialogTitle>
                <DialogDescription>Сделка перейдёт в «Продажа», когда руководитель подтвердит оплату по чеку.</DialogDescription>
              </DialogHeader>
              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Тип оплаты</legend>
                <div className="grid grid-cols-2 gap-2" role="radiogroup">
                  {SALE_KINDS.map((item) => (
                    <label
                      key={item.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-border",
                        kind === item.value && "bg-primary/5 ring-primary"
                      )}
                    >
                      <input type="radio" name="sale-kind" value={item.value} checked={kind === item.value} onChange={() => setKind(item.value)} className="accent-(--primary)" />
                      {item.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="sale-amount">Сумма{currency ? `, ${currency}` : ""}</Label>
                  <Input id="sale-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="15000" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sale-paid-on">Дата оплаты</Label>
                  <Input id="sale-paid-on" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
                </div>
              </div>
              <ReceiptField file={receipt} onChange={setReceipt} />
              {failure && (
                <p role="alert" className="text-sm text-destructive">
                  {failure}
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
                  Отправить на проверку
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
