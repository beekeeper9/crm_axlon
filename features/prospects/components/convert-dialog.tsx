"use client"

import { useState, useTransition } from "react"
import { LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ProductSelect } from "@/features/products/components/product-select"
import { convertProspectAction } from "@/features/prospects/actions"
import type { ConversionResult } from "@/features/prospects/api/prospects-repository"

/** Воронка и её рабочие этапы, куда может встать новая сделка */
export type ConvertPipeline = { id: string; name: string; stages: readonly { id: string; name: string }[] }

/** Из чего выбирают при переводе в клиенты: воронки с этапами и продукты компании */
export type ConvertOptions = { pipelines: readonly ConvertPipeline[]; products: readonly { id: string; name: string }[] }

export const NO_CONVERT_OPTIONS: ConvertOptions = { pipelines: [], products: [] }

export type ConvertTarget = {
  id: string
  name: string
  /** Новый лид сначала квалифицируется: backend конвертирует только квалифицированный */
  needsQualification: boolean
  /** Существующие клиенты с тем же телефоном или e-mail */
  customerCandidates: readonly { id: string; name: string; contact: string | null }[]
}

const NEW_CUSTOMER = "new"

type ConvertDialogProps = {
  target: ConvertTarget | null
  options: ConvertOptions
  /** Пояснение под заголовком (например, где проверить дубли) */
  note?: string
  onClose: () => void
  onConverted: (result: ConversionResult) => void
}

/**
 * «Стал клиентом»: клиент (новый или существующий), сделка, этап воронки продаж и следующий
 * шаг. Без шага конвертировать нельзя — сделка не придёт на «Продажи» без следующего шага.
 */
export function ConvertDialog({ target, options, note, onClose, onConverted }: ConvertDialogProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {target && <ConvertForm key={target.id} target={target} options={options} note={note} onClose={onClose} onConverted={onConverted} />}
      </DialogContent>
    </Dialog>
  )
}

function ConvertForm({ target, options, note, onClose, onConverted }: Omit<ConvertDialogProps, "target"> & { target: ConvertTarget }) {
  const { pipelines, products } = options
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [customer, setCustomer] = useState(target.customerCandidates[0]?.id ?? NEW_CUSTOMER)
  const [pipelineId, setPipelineId] = useState<string | null>(pipelines[0]?.id ?? null)
  const pipeline = pipelines.find((item) => item.id === pipelineId) ?? null
  const [stageId, setStageId] = useState<string | null>(pipeline?.stages[0]?.id ?? null)
  const [productId, setProductId] = useState<string | null>(null)
  const [deal, setDeal] = useState({ title: target.name, amount: "", nextStepTitle: "", nextStepDue: "" })
  const field = (key: keyof typeof deal) => ({
    value: deal[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDeal((current) => ({ ...current, [key]: event.target.value })),
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await convertProspectAction(target.id, {
        customerId: customer === NEW_CUSTOMER ? null : customer,
        deal: { ...deal, pipelineId, stageId, productId },
        qualifyFirst: target.needsQualification,
      })
      if (!result.ok) {
        setFailure(result.requestId ? `${result.message} Код запроса: ${result.requestId}` : result.message)
        return
      }
      onConverted(result.data)
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>«{target.name}» стал клиентом</DialogTitle>
        <DialogDescription>Сделка сразу появится на «Продажах» на выбранном этапе — со следующим шагом.</DialogDescription>
        {note && <p className="text-meta text-muted-foreground">{note}</p>}
      </DialogHeader>

      {target.customerCandidates.length > 0 && (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-sm font-medium">Клиент</legend>
          {target.customerCandidates.map((candidate) => (
            <label key={candidate.id} className="flex items-center gap-2 text-sm">
              <input type="radio" name="convert-customer" checked={customer === candidate.id} onChange={() => setCustomer(candidate.id)} className="size-4 accent-(--primary)" />
              Привязать к существующему: {candidate.name}
              {candidate.contact && <span className="text-muted-foreground tabular-nums">{candidate.contact}</span>}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="convert-customer" checked={customer === NEW_CUSTOMER} onChange={() => setCustomer(NEW_CUSTOMER)} className="size-4 accent-(--primary)" />
            Создать нового клиента
          </label>
        </fieldset>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="convert-deal-title">Название сделки</Label>
          <Input id="convert-deal-title" {...field("title")} maxLength={200} className="h-9" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="convert-deal-amount">Сумма</Label>
          <Input id="convert-deal-amount" {...field("amount")} inputMode="decimal" placeholder="15000" className="h-9" />
        </div>
      </div>

      <ProductSelect id="convert-product" products={products} value={productId} onChange={setProductId} />

      <div className="grid gap-3 sm:grid-cols-2">
        {pipelines.length > 1 && (
          <div className="grid gap-1.5">
            <Label htmlFor="convert-pipeline">Воронка</Label>
            <Select
              items={pipelines.map((item) => ({ value: item.id, label: item.name }))}
              value={pipelineId}
              onValueChange={(next) => {
                setPipelineId(next)
                setStageId(pipelines.find((item) => item.id === next)?.stages[0]?.id ?? null)
              }}
            >
              <SelectTrigger id="convert-pipeline" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="convert-stage">Этап воронки продаж</Label>
          <Select items={(pipeline?.stages ?? []).map((stage) => ({ value: stage.id, label: stage.name }))} value={stageId} onValueChange={setStageId}>
            <SelectTrigger id="convert-stage" className="h-9 w-full">
              <SelectValue placeholder="Первый этап" />
            </SelectTrigger>
            <SelectContent>
              {(pipeline?.stages ?? []).map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <fieldset className="grid gap-3 rounded-lg p-3 ring-1 ring-border">
        <legend className="px-1 text-sm font-medium">Следующий шаг</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="convert-step-title">Что сделать</Label>
          <Textarea id="convert-step-title" {...field("nextStepTitle")} rows={2} maxLength={200} placeholder="Например: отправить КП и перезвонить" />
        </div>
        <div className="grid gap-1.5 sm:w-1/2">
          <Label htmlFor="convert-step-due">Когда</Label>
          <Input id="convert-step-due" type="date" {...field("nextStepDue")} className="h-9" />
        </div>
      </fieldset>

      {failure && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {failure}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Отмена
        </Button>
        <Button type="submit" disabled={isPending} aria-busy={isPending}>
          {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
          Перевести в клиенты
        </Button>
      </DialogFooter>
    </form>
  )
}
