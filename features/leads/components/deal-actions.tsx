"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CircleCheckBig, LoaderCircle, Pencil, RotateCcw, UserRoundCog } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { LeadDetail } from "@/features/leads/schemas"
import { assignDealAction, moveDealStageAction, reopenDealAction, updateDealAction, type DealActionResult } from "@/features/sales/actions"
import { CloseDealDialog, type CloseDealResult } from "@/features/sales/components/close-deal-dialog"
import type { LossReason } from "@/features/sales/schemas"

type Person = { id: string; name: string }

type DealActionsProps = {
  lead: LeadDetail
  lossReasons: readonly LossReason[]
  /** Кому можно передать сделку; пусто — передавать нельзя */
  members: readonly Person[]
}

/** Правка, передача, закрытие и повторное открытие сделки через backend */
export function DealActions({ lead, lossReasons, members }: DealActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [dialog, setDialog] = useState<"edit" | "assign" | "close" | null>(null)
  const isOpen = lead.status === "open"
  const stages = lead.pipeline.stages

  function act(operation: () => Promise<DealActionResult>) {
    startTransition(async () => {
      const result = await operation()
      if (result.ok) {
        setFailure(null)
        setDialog(null)
        router.refresh()
      } else setFailure(result.requestId ? `${result.message} Код запроса: ${result.requestId}` : result.message)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {isOpen && lead.version !== null && (
          <Button size="sm" variant="outline" onClick={() => setDialog("edit")} disabled={isPending}>
            <Pencil data-icon="inline-start" aria-hidden />
            Изменить
          </Button>
        )}
        {isOpen && members.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setDialog("assign")} disabled={isPending}>
            <UserRoundCog data-icon="inline-start" aria-hidden />
            Передать
          </Button>
        )}
        {isOpen ? (
          <Button size="sm" onClick={() => setDialog("close")} disabled={isPending}>
            <CircleCheckBig data-icon="inline-start" aria-hidden />
            Закрыть сделку
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => act(() => reopenDealAction(lead.id))} disabled={isPending}>
            {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <RotateCcw data-icon="inline-start" aria-hidden />}
            Открыть снова
          </Button>
        )}
      </div>
      {!isOpen && lead.lostReason && <p className="text-meta text-muted-foreground">Причина отказа: {lead.lostReason}</p>}
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}

      {dialog === "edit" && lead.version !== null && (
        <EditDealDialog
          lead={lead}
          isPending={isPending}
          onCancel={() => setDialog(null)}
          onSave={(values) => act(() => updateDealAction(lead.id, lead.version ?? 0, values))}
          failure={failure}
        />
      )}
      {dialog === "assign" && (
        <AssignDialog
          members={members}
          current={lead.manager.id}
          isPending={isPending}
          failure={failure}
          onCancel={() => setDialog(null)}
          onSave={(ownerId) => act(() => assignDealAction(lead.id, ownerId))}
        />
      )}
      <CloseDealDialog
        deal={dialog === "close" ? { id: lead.id, title: lead.title } : null}
        wonStage={stages.find((stage) => stage.kind === "won")}
        lostStage={stages.find((stage) => stage.kind === "lost")}
        lossReasons={lossReasons}
        isDemo={false}
        isPending={isPending}
        failure={failure}
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={({ stageId, lossReasonId, comment }: CloseDealResult) =>
          act(() => moveDealStageAction(lead.id, stageId, stages.find((stage) => stage.id === stageId)?.kind === "lost" ? { lossReasonId, comment } : null))
        }
      />
    </div>
  )
}

type DealFormValues = { title: string; amount: string; nextStep: string; expectedCloseDate: string; source: string }

function EditDealDialog({
  lead,
  isPending,
  failure,
  onCancel,
  onSave,
}: {
  lead: LeadDetail
  isPending: boolean
  failure: string | null
  onCancel: () => void
  onSave: (values: DealFormValues) => void
}) {
  const [values, setValues] = useState<DealFormValues>({
    title: lead.title,
    amount: lead.amount ?? "0",
    nextStep: lead.nextStep ?? "",
    expectedCloseDate: lead.expectedCloseDate ?? "",
    source: lead.source ?? "",
  })
  const field = (key: keyof DealFormValues) => ({
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues((current) => ({ ...current, [key]: event.target.value })),
  })
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            onSave(values)
          }}
        >
          <DialogHeader>
            <DialogTitle>Изменить сделку</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="deal-edit-title">Название</Label>
            <Input id="deal-edit-title" {...field("title")} maxLength={200} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="deal-edit-amount">Сумма{lead.currency ? `, ${lead.currency}` : ""}</Label>
            <Input id="deal-edit-amount" {...field("amount")} inputMode="decimal" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="deal-edit-next">Следующий шаг</Label>
            <Input id="deal-edit-next" {...field("nextStep")} maxLength={300} placeholder="Например: созвониться в пятницу и согласовать договор" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="deal-edit-source">Источник</Label>
            <Input id="deal-edit-source" {...field("source")} maxLength={100} placeholder="Например: сайт, Instagram, рекомендация" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="deal-edit-close">Ожидаемая дата закрытия</Label>
            <Input id="deal-edit-close" type="date" {...field("expectedCloseDate")} />
          </div>
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
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
  )
}

function AssignDialog({
  members,
  current,
  isPending,
  failure,
  onCancel,
  onSave,
}: {
  members: readonly Person[]
  current: string
  isPending: boolean
  failure: string | null
  onCancel: () => void
  onSave: (ownerId: string) => void
}) {
  const [owner, setOwner] = useState<string | null>(current)
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Передать сделку</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="deal-owner">Ответственный</Label>
          <Select items={members.map((m) => ({ value: m.id, label: m.name }))} value={owner} onValueChange={setOwner}>
            <SelectTrigger id="deal-owner" className="w-full">
              <SelectValue placeholder="Выберите сотрудника" />
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button onClick={() => owner && onSave(owner)} disabled={isPending || !owner || owner === current}>
            Передать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
