"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RecordSalePaymentDialog } from "@/features/payments/components/record-sale-payment-dialog"
import { moveDealStageAction, type DealActionResult } from "@/features/sales/actions"
import type { StageMoveExtras } from "@/features/sales/api/deal-mutations"
import type { PipelineStage } from "@/features/sales/schemas"
import { companyDateOf, companyWallTimeToIso } from "@/lib/datetime"

type Loss = { lossReasonId: string | null; comment: string }

/** Что спросить перед переходом: следующий шаг, новое время встречи или оплату для «Продажи» */
type Need = "next_step" | "meeting" | "sale"

type PendingMove = { dealId: string; dealTitle: string; stage: PipelineStage; loss: Loss | null; need: Need }

const DURATIONS = [30, 45, 60, 90, 120].map((minutes) => ({ value: String(minutes), label: `${minutes} мин` }))
const DAY_MS = 86_400_000

/**
 * Переход сделки по этапам с правилами воронки: «Продажа» открывает внесение оплаты (сделку
 * закрывает подтверждённая оплата), «Встреча перенесена» спрашивает новое время встречи,
 * другой рабочий этап — следующий шаг, если backend ответил, что его нет (next_step_required).
 */
export function useStageMove({ onMoved }: { onMoved?: () => void } = {}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pending, setPending] = useState<PendingMove | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  function send(move: Omit<PendingMove, "need">, extras: StageMoveExtras) {
    startTransition(async () => {
      const result: DealActionResult = await moveDealStageAction(move.dealId, move.stage.id, move.loss, extras)
      if (result.ok) {
        setPending(null)
        setFailure(null)
        onMoved?.()
        router.refresh()
        return
      }
      const asked = result.code === "next_step_required" ? "next_step" : result.code === "meeting_date_required" ? "meeting" : null
      if (asked && !extras.nextStep && !extras.meetingStart) {
        // Правило воронки: спрашиваем недостающее в окне вместо ошибки
        setPending({ ...move, need: asked })
        setFailure(null)
        return
      }
      if (result.code === "sale_requires_payment") {
        setPending({ ...move, need: "sale" })
        setFailure(null)
        return
      }
      setFailure(result.requestId ? `${result.message} Код запроса: ${result.requestId}` : result.message)
    })
  }

  /** Перевести сделку на этап (для этапа отказа — с причиной) */
  function move(dealId: string, dealTitle: string, stage: PipelineStage, loss: Loss | null = null) {
    setFailure(null)
    // Любой этап «успех» — только через оплату: сделку закрывает подтверждённый платёж
    if (stage.kind === "won") return setPending({ dealId, dealTitle, stage, loss, need: "sale" })
    if (stage.systemCode === "meeting_rescheduled") return setPending({ dealId, dealTitle, stage, loss, need: "meeting" })
    send({ dealId, dealTitle, stage, loss }, {})
  }

  function close() {
    setPending(null)
    setFailure(null)
  }

  const dialog = (
    <>
      <Dialog open={pending !== null && pending.need !== "sale"} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-md">
          {pending?.need === "meeting" && (
            <MeetingTimeForm key={pending.dealId} move={pending} isPending={isPending} failure={failure} onCancel={close} onSubmit={(extras) => send(pending, extras)} />
          )}
          {pending?.need === "next_step" && (
            <NextStepForm key={pending.dealId} move={pending} isPending={isPending} failure={failure} onCancel={close} onSubmit={(extras) => send(pending, extras)} />
          )}
        </DialogContent>
      </Dialog>
      {pending?.need === "sale" && (
        <RecordSalePaymentDialog
          dealId={pending.dealId}
          open
          onOpenChange={(open) => !open && close()}
          onSubmitted={() => {
            onMoved?.()
            router.refresh()
          }}
        />
      )}
    </>
  )

  return { move, isPending, failure: pending ? null : failure, dialog }
}

type FormProps = {
  move: PendingMove
  isPending: boolean
  failure: string | null
  onCancel: () => void
  onSubmit: (extras: StageMoveExtras) => void
}

function NextStepForm({ move, isPending, failure, onCancel, onSubmit }: FormProps) {
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState(() => companyDateOf(new Date(Date.now() + DAY_MS).toISOString()))
  const [error, setError] = useState<string | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (title.trim().length < 2) return setError("Опишите следующий шаг")
    if (!dueDate) return setError("Укажите срок")
    setError(null)
    onSubmit({ nextStep: { title: title.trim(), dueDate } })
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Следующий шаг</DialogTitle>
        <DialogDescription>
          «{move.dealTitle}» → {move.stage.name}. У сделки нет открытой задачи со сроком: запланируйте, что делать дальше.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
        <div className="grid gap-1.5">
          <Label htmlFor="next-step-title">Что сделать</Label>
          <Input
            id="next-step-title"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: позвонить и обсудить КП"
            aria-invalid={error !== null && title.trim().length < 2}
            autoFocus
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="next-step-due">Срок</Label>
          <Input id="next-step-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-invalid={error !== null && !dueDate} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Задача появится у ответственного за сделку.</p>
      <FormFooter error={error ?? failure} isPending={isPending} submitLabel="Перевести и поставить задачу" onCancel={onCancel} />
    </form>
  )
}

function MeetingTimeForm({ move, isPending, failure, onCancel, onSubmit }: FormProps) {
  const [startsAt, setStartsAt] = useState("")
  const [duration, setDuration] = useState<string | null>("60")
  const [error, setError] = useState<string | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!startsAt) return setError("Укажите новую дату и время встречи")
    const start = companyWallTimeToIso(startsAt)
    const end = new Date(new Date(start).getTime() + Number(duration ?? "60") * 60_000).toISOString()
    setError(null)
    onSubmit({ meetingStart: start, meetingEnd: end })
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Встреча перенесена</DialogTitle>
        <DialogDescription>
          «{move.dealTitle}». Укажите новое время: ближайшая встреча по сделке переедет на него (старая дата останется в истории), а
          если встречи нет — она будет назначена ответственному.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
        <div className="grid gap-1.5">
          <Label htmlFor="rescheduled-start">Новая дата и время</Label>
          <Input
            id="rescheduled-start"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            aria-invalid={error !== null && !startsAt}
            autoFocus
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rescheduled-duration">Длительность</Label>
          <Select items={DURATIONS} value={duration} onValueChange={setDuration}>
            <SelectTrigger id="rescheduled-duration" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <FormFooter error={error ?? failure} isPending={isPending} submitLabel="Перенести встречу" onCancel={onCancel} />
    </form>
  )
}

function FormFooter({ error, isPending, submitLabel, onCancel }: { error: string | null; isPending: boolean; submitLabel: string; onCancel: () => void }) {
  return (
    <>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </>
  )
}
