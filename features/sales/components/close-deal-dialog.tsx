"use client"

import { useState } from "react"
import { CircleCheckBig, CircleX } from "lucide-react"
import { cn } from "@/lib/utils"

import { DemoNotice } from "@/components/shared/demo-notice"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Deal, LossReason, PipelineStage } from "@/features/sales/schemas"

export type CloseDealResult = {
  dealId: string
  stageId: string
  lossReasonId: string | null
  comment: string
}

type CloseDealDialogProps = {
  deal: Deal | null
  wonStage: PipelineStage | undefined
  lostStage: PipelineStage | undefined
  lossReasons: readonly LossReason[]
  isDemo: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (result: CloseDealResult) => void
}

type Outcome = "won" | "lost"

export function CloseDealDialog({ deal, ...props }: CloseDealDialogProps) {
  return (
    <Dialog open={deal !== null} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Форма монтируется заново для каждой сделки — без ручного сброса полей */}
        {deal && <CloseDealForm key={deal.id} deal={deal} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function CloseDealForm({
  deal,
  wonStage,
  lostStage,
  lossReasons,
  isDemo,
  onOpenChange,
  onConfirm,
}: Omit<CloseDealDialogProps, "deal"> & { deal: Deal }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [reasonId, setReasonId] = useState<string | null>(null)
  const [comment, setComment] = useState("")
  const [showErrors, setShowErrors] = useState(false)

  const targetStage = outcome === "won" ? wonStage : outcome === "lost" ? lostStage : undefined
  const reasonMissing = outcome === "lost" && !reasonId

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!targetStage || reasonMissing) {
      setShowErrors(true)
      return
    }
    onConfirm({ dealId: deal.id, stageId: targetStage.id, lossReasonId: reasonId, comment: comment.trim() })
  }

  const options: { value: Outcome; stage: PipelineStage | undefined; icon: typeof CircleCheckBig; tone: string }[] = [
    { value: "won", stage: wonStage, icon: CircleCheckBig, tone: "has-checked:border-success has-checked:bg-success/10 [&_svg]:text-success" },
    { value: "lost", stage: lostStage, icon: CircleX, tone: "has-checked:border-destructive has-checked:bg-destructive/10 [&_svg]:text-destructive" },
  ]

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Закрыть сделку</DialogTitle>
        <DialogDescription>{deal.title}</DialogDescription>
      </DialogHeader>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Результат</legend>
        <div className="grid grid-cols-2 gap-2">
          {options.map(({ value, stage, icon: Icon, tone }) =>
            stage ? (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50 has-focus-visible:ring-2 has-focus-visible:ring-ring/60",
                  tone
                )}
              >
                <input
                  type="radio"
                  name="outcome"
                  value={value}
                  checked={outcome === value}
                  onChange={() => setOutcome(value)}
                  className="sr-only"
                />
                <Icon className="size-4 shrink-0" aria-hidden />
                {stage.name}
              </label>
            ) : null
          )}
        </div>
        {showErrors && !outcome && <p className="text-xs text-destructive">Выберите результат сделки</p>}
        {outcome === "won" && (
          <p className="text-xs text-muted-foreground">
            По правилам компании сделку можно закрыть успешно только с оплатой — это проверит сервер.
          </p>
        )}
      </fieldset>

      {outcome === "lost" && (
        <div className="grid gap-2">
          <Label htmlFor="loss-reason">Причина отказа</Label>
          <Select items={lossReasons.map((reason) => ({ value: reason.id, label: reason.label }))} value={reasonId} onValueChange={setReasonId}>
            <SelectTrigger id="loss-reason" className="w-full" aria-invalid={showErrors && reasonMissing}>
              <SelectValue placeholder="Выберите из справочника" />
            </SelectTrigger>
            <SelectContent>
              {lossReasons.map((reason) => (
                <SelectItem key={reason.id} value={reason.id}>
                  {reason.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showErrors && reasonMissing && <p className="text-xs text-destructive">Причина обязательна</p>}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="close-comment">Комментарий</Label>
        <Textarea
          id="close-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Например: выбрал вариант дешевле, вернуться через полгода"
          rows={3}
        />
      </div>

      {isDemo && <DemoNotice>Демо-режим: сделка уйдёт с доски только на этой странице, ничего не сохранится.</DemoNotice>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Отмена
        </Button>
        <Button type="submit" variant={outcome === "lost" ? "destructive" : "default"}>
          {outcome === "lost" ? "Закрыть как нереализованную" : "Закрыть сделку"}
        </Button>
      </DialogFooter>
    </form>
  )
}
