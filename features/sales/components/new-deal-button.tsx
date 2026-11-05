"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { leadRoute } from "@/config/routes"
import { ProductSelect } from "@/features/products/components/product-select"
import { createDealAction } from "@/features/sales/actions"

/**
 * Новая сделка в текущей воронке (первый этап выбирает backend). Сделку для существующего
 * клиента создают из его карточки в «Базе клиентов», а клиента из заявки — конвертацией лида.
 */
type NewDealButtonProps = {
  pipelineId: string
  pipelineName: string
  /** Активные продукты компании; пусто — поле не показывается */
  products: readonly { id: string; name: string }[]
}

export function NewDealButton({ pipelineId, pipelineName, products }: NewDealButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [values, setValues] = useState({ title: "", amount: "", nextStep: "" })
  const [productId, setProductId] = useState<string | null>(null)
  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues((current) => ({ ...current, [key]: event.target.value })),
  })

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" aria-hidden />
        Новая сделка
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            className="grid gap-3"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              startTransition(async () => {
                const result = await createDealAction({ ...values, pipelineId, productId })
                if (result.ok) {
                  setOpen(false)
                  router.push(leadRoute(result.data))
                } else setFailure(result.message)
              })
            }}
          >
            <DialogHeader>
              <DialogTitle>Новая сделка</DialogTitle>
              <DialogDescription>Воронка «{pipelineName}». Для повторной покупки клиента откройте его карточку в «Базе клиентов».</DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="new-deal-title">Название</Label>
              <Input id="new-deal-title" {...field("title")} maxLength={200} autoFocus />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-deal-amount">Сумма</Label>
              <Input id="new-deal-amount" {...field("amount")} inputMode="decimal" placeholder="15000" />
            </div>
            <ProductSelect id="new-deal-product" products={products} value={productId} onChange={setProductId} />
            <div className="grid gap-1.5">
              <Label htmlFor="new-deal-next">Следующий шаг</Label>
              <Input id="new-deal-next" {...field("nextStep")} maxLength={300} />
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
                Создать и открыть
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
