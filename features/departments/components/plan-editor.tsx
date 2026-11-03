"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { setPlansAction } from "@/features/departments/actions"
import { currencyOptions } from "@/features/departments/lib/plan-distribution"

type PlanEditorProps = {
  scope: "company" | "department"
  scopeId: string | null
  /** Месяц плана ГГГГ-ММ */
  month: string
  /** Кому план: «компании», «отдела Север» */
  title: string
  salesTarget: string | null
  moneyTarget: string | null
  currency: string | null
  companyCurrency: string
  /** Подпись кнопки: «Задать план» / «Изменить план» */
  label?: string
}

/** Цифра цели для поля ввода: «20.00» → «20» */
function toInput(value: string | null): string {
  if (value === null) return ""
  return value.replace(/\.00$/, "")
}

/**
 * Форма плана на месяц: количество продаж и денежный план с валютой. Сохраняет через
 * backend (`PUT /plans/`); каждое изменение попадает в историю плана. Только директор.
 */
export function PlanEditor({ scope, scopeId, month, title, salesTarget, moneyTarget, currency, companyCurrency, label }: PlanEditorProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [sales, setSales] = useState(toInput(salesTarget))
  const [money, setMoney] = useState(toInput(moneyTarget))
  const [code, setCode] = useState(currency ?? companyCurrency)
  const hasPlan = salesTarget !== null || moneyTarget !== null

  function reset() {
    setSales(toInput(salesTarget))
    setMoney(toInput(moneyTarget))
    setCode(currency ?? companyCurrency)
    setFailure(null)
  }

  return (
    <>
      <Button
        size="sm"
        variant={hasPlan ? "outline" : "default"}
        onClick={() => {
          reset()
          setOpen(true)
        }}
      >
        <Pencil data-icon="inline-start" aria-hidden />
        {label ?? (hasPlan ? "Изменить план" : "Задать план")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            className="grid gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              startTransition(async () => {
                const error = await setPlansAction({ scope, scopeId, period: month, salesTarget: sales, moneyTarget: money, currency: code })
                setFailure(error)
                if (!error) {
                  setOpen(false)
                  router.refresh()
                }
              })
            }}
          >
            <DialogHeader>
              <DialogTitle>План {title}</DialogTitle>
              <DialogDescription>Месяц {month}. Факт и процент выполнения считает сервер.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="plan-sales">Продаж (сделок с первой оплатой)</Label>
              <Input id="plan-sales" value={sales} onChange={(e) => setSales(e.target.value)} inputMode="decimal" placeholder="например, 20" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="plan-money">Денежный план (оборот)</Label>
              <div className="flex gap-2">
                <Input id="plan-money" value={money} onChange={(e) => setMoney(e.target.value)} inputMode="decimal" placeholder="например, 1500000" />
                <Select items={currencyOptions(companyCurrency).map((value) => ({ value, label: value }))} value={code} onValueChange={(value) => value && setCode(value)}>
                  <SelectTrigger className="w-28" aria-label="Валюта плана">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions(companyCurrency).map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">В факт войдут только оплаты в этой валюте — без пересчёта курса.</p>
            </div>
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
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
