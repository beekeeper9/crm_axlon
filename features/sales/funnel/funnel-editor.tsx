"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Check, LoaderCircle, Lock, Plus, Power, Star, Trash2 } from "lucide-react"

import { StatusBadge, type StatusTone } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  addStageAction,
  deleteStageAction,
  makeDefaultFunnelAction,
  renameFunnelAction,
  renameStageAction,
  reorderStagesAction,
  setStageActiveAction,
  type FunnelActionResult,
} from "@/features/sales/funnel/funnel-actions"
import type { Funnel, FunnelStage } from "@/features/sales/funnel/funnel-api"
import { activeStages, isLastOfKind, isSaleStage, isSystemStage, KIND_LABELS, movedOrder, moveTargets } from "@/features/sales/funnel/funnel-rules"
import { formatNumber, pluralize } from "@/lib/format"

const KIND_TONES: Record<FunnelStage["kind"], StatusTone> = { open: "info", won: "success", lost: "danger" }

/**
 * Этапы воронки: переименование, порядок, добавление и удаление. Каждое действие сразу
 * сохраняется на сервере; список после этого — ответ сервера (router.refresh).
 */
export function FunnelEditor({ funnel }: { funnel: Funnel }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<FunnelStage | null>(null)
  const stages = activeStages(funnel.stages)
  // Выключенный системный этап — не архив: его можно включить обратно
  const switchedOff = funnel.stages.filter((stage) => !stage.isActive && stage.systemCode === "meeting_rescheduled")
  const archived = funnel.stages.filter((stage) => !stage.isActive && !isSystemStage(stage))
  const lastMovable = stages.filter((stage) => !isSaleStage(stage)).length - 1
  const toggle = (stage: FunnelStage, isActive: boolean) =>
    act(
      () => setStageActiveAction(funnel.id, stage.id, isActive),
      () => setNotice(isActive ? `Этап «${stage.name}» включён.` : `Этап «${stage.name}» выключен: менеджеры его не видят.`)
    )

  function act<T>(operation: () => Promise<FunnelActionResult<T>>, done?: (data: T) => void) {
    startTransition(async () => {
      const result = await operation()
      if (result.ok) {
        setFailure(null)
        done?.(result.data)
        router.refresh()
      } else setFailure(result.message)
    })
  }

  return (
    <div className="space-y-4">
      <FunnelNameForm
        key={funnel.name}
        name={funnel.name}
        isPending={isPending}
        onRename={(name) => act(() => renameFunnelAction(funnel.id, name), () => setNotice(`Воронка переименована: «${name}».`))}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-meta text-muted-foreground">
          {funnel.isDefault ? "Основная воронка: сюда попадают новые сделки менеджеров." : "Дополнительная воронка."}
        </p>
        {!funnel.isDefault && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => act(() => makeDefaultFunnelAction(funnel.id), () => setNotice("Воронка стала основной."))}>
            <Star data-icon="inline-start" aria-hidden />
            Сделать основной
          </Button>
        )}
      </div>

      {(failure || notice) && (
        <p role={failure ? "alert" : "status"} className={failure ? "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" : "rounded-lg bg-success/10 px-3 py-2 text-sm text-success"}>
          {failure ?? notice}
        </p>
      )}

      <ol className="divide-y rounded-xl ring-1 ring-border" aria-label="Этапы воронки">
        {stages.map((stage, index) => (
          <StageRow
            key={stage.id}
            stage={stage}
            index={index}
            isFirst={index === 0 || isSaleStage(stage)}
            isLast={index >= lastMovable}
            isPending={isPending}
            canDelete={!isSystemStage(stage) && !isLastOfKind(funnel.stages, stage.id)}
            onSwitchOff={stage.systemCode === "meeting_rescheduled" ? () => toggle(stage, false) : undefined}
            onRename={(name) => act(() => renameStageAction(funnel.id, stage.id, name), () => setNotice(`Этап переименован: «${name}».`))}
            onMove={(direction) => {
              const order = movedOrder(funnel.stages, stage.id, direction)
              if (order) act(() => reorderStagesAction(funnel.id, order), () => setNotice(null))
            }}
            onDelete={() => {
              setNotice(null)
              setFailure(null)
              setDeleting(stage)
            }}
          />
        ))}
      </ol>

      {switchedOff.map((stage) => (
        <p key={stage.id} className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Системный этап «{stage.name}» выключен — менеджеры не могут перевести на него сделку.</span>
          <Button size="xs" variant="outline" disabled={isPending} onClick={() => toggle(stage, true)}>
            <Power data-icon="inline-start" aria-hidden />
            Включить
          </Button>
        </p>
      ))}

      <AddStageForm isPending={isPending} onAdd={(name, kind) => act(() => addStageAction(funnel.id, name, kind), () => setNotice(`Этап «${name}» добавлен.`))} />

      {archived.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">В архиве: {formatNumber(archived.length)}</summary>
          <p className="mt-1 text-meta text-muted-foreground">
            Удалённые этапы, на которых раньше были сделки. Их названия остаются в истории сделок.
          </p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {archived.map((stage) => (
              <li key={stage.id}>{stage.name}</li>
            ))}
          </ul>
        </details>
      )}

      <DeleteStageDialog
        funnel={funnel}
        stage={deleting}
        isPending={isPending}
        failure={deleting ? failure : null}
        onClose={() => {
          setDeleting(null)
          setFailure(null)
        }}
        onConfirm={(stage, target) =>
          act(
            () => deleteStageAction(funnel.id, stage.id, target),
            (result) => {
              setDeleting(null)
              setNotice(
                result.movedDeals > 0
                  ? `Этап «${stage.name}» удалён. Перенесено ${formatNumber(result.movedDeals)} ${pluralize(result.movedDeals, ["сделка", "сделки", "сделок"])}; переход записан в историю сделок.`
                  : `Этап «${stage.name}» удалён.`
              )
            }
          )
        }
      />
    </div>
  )
}

function StageRow({
  stage,
  index,
  isFirst,
  isLast,
  isPending,
  canDelete,
  onRename,
  onMove,
  onDelete,
  onSwitchOff,
}: {
  stage: FunnelStage
  index: number
  isFirst: boolean
  isLast: boolean
  isPending: boolean
  canDelete: boolean
  onRename: (name: string) => void
  onMove: (direction: -1 | 1) => void
  onDelete: () => void
  /** Только «Встреча перенесена»: системный этап, который РОП может выключить */
  onSwitchOff?: () => void
}) {
  const [name, setName] = useState(stage.name)
  const changed = name.trim() !== stage.name && name.trim().length > 0
  const isSystem = isSystemStage(stage)
  const isSale = isSaleStage(stage)

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap">
      <span className="w-6 shrink-0 text-meta text-muted-foreground tabular-nums">{index + 1}</span>
      {/* На телефоне название — отдельной строкой, чтобы его было удобно править */}
      <form
        className="flex min-w-0 flex-1 basis-[calc(100%-2rem)] items-center gap-2 sm:basis-0"
        onSubmit={(event) => {
          event.preventDefault()
          if (changed) onRename(name.trim())
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          aria-label={`Название этапа ${index + 1}`}
          className="h-8 min-w-0"
          readOnly={isSystem}
          title={isSystem ? "Системный этап: название не меняется" : undefined}
        />
        {isSystem && (
          <span className="shrink-0" title={isSale ? "Сделка попадает сюда только после подтверждённой оплаты; этап всегда последний" : "Переход требует новой даты встречи; этап можно передвинуть или выключить"}>
            <StatusBadge tone="neutral">
              <Lock className="size-3" aria-hidden />
              Системный
            </StatusBadge>
          </span>
        )}
        {changed && !isSystem && (
          <Button type="submit" size="icon-sm" variant="outline" disabled={isPending} aria-label="Сохранить название">
            <Check aria-hidden />
          </Button>
        )}
      </form>
      <StatusBadge tone={KIND_TONES[stage.kind]} className="max-sm:ml-8">
        {KIND_LABELS[stage.kind]}
      </StatusBadge>
      <span className="shrink-0 text-meta text-muted-foreground tabular-nums sm:w-28 sm:text-right" title="Сделок на этапе: в работе / всего">
        {formatNumber(stage.openDeals ?? 0)} / {formatNumber(stage.totalDeals ?? 0)} сделок
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button size="icon-sm" variant="ghost" disabled={isPending || isFirst || isSale} onClick={() => onMove(-1)} aria-label="Выше">
          <ArrowUp aria-hidden />
        </Button>
        <Button size="icon-sm" variant="ghost" disabled={isPending || isLast || isSale} onClick={() => onMove(1)} aria-label="Ниже">
          <ArrowDown aria-hidden />
        </Button>
        {onSwitchOff ? (
          <Button size="icon-sm" variant="ghost" disabled={isPending} onClick={onSwitchOff} aria-label={`Выключить этап «${stage.name}»`} title="Выключить этап">
            <Power aria-hidden />
          </Button>
        ) : (
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={isPending || !canDelete}
            onClick={onDelete}
            aria-label={`Удалить этап «${stage.name}»`}
            title={
              canDelete ? undefined : isSystem ? "Системный этап нельзя удалить" : "Это последний этап такого вида: в воронке должен остаться хотя бы один"
            }
          >
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>
    </li>
  )
}

function AddStageForm({ isPending, onAdd }: { isPending: boolean; onAdd: (name: string, kind: FunnelStage["kind"]) => void }) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<FunnelStage["kind"]>("open")
  const kinds = (Object.keys(KIND_LABELS) as FunnelStage["kind"][]).map((value) => ({ value, label: KIND_LABELS[value] }))

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return
        onAdd(name.trim(), kind)
        setName("")
      }}
    >
      <div className="grid min-w-48 flex-1 gap-1.5">
        <Label htmlFor="new-stage-name">Новый этап</Label>
        <Input id="new-stage-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Например: Повторный контакт" className="h-8" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="new-stage-kind">Вид</Label>
        <Select items={kinds} value={kind} onValueChange={(value) => value && setKind(value as FunnelStage["kind"])}>
          <SelectTrigger id="new-stage-kind" className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kinds.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={isPending || !name.trim()}>
        {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <Plus data-icon="inline-start" aria-hidden />}
        Добавить
      </Button>
    </form>
  )
}

function DeleteStageDialog({
  funnel,
  stage,
  isPending,
  failure,
  onClose,
  onConfirm,
}: {
  funnel: Funnel
  stage: FunnelStage | null
  isPending: boolean
  failure: string | null
  onClose: () => void
  onConfirm: (stage: FunnelStage, moveToStageId: string | null) => void
}) {
  return (
    <Dialog open={stage !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {stage && <DeleteStageForm key={stage.id} funnel={funnel} stage={stage} isPending={isPending} failure={failure} onClose={onClose} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  )
}

function DeleteStageForm({
  funnel,
  stage,
  isPending,
  failure,
  onClose,
  onConfirm,
}: {
  funnel: Funnel
  stage: FunnelStage
  isPending: boolean
  failure: string | null
  onClose: () => void
  onConfirm: (stage: FunnelStage, moveToStageId: string | null) => void
}) {
  const total = stage.totalDeals ?? 0
  const targets = moveTargets(funnel.stages, stage.id)
  const [target, setTarget] = useState<string | null>(targets[0]?.id ?? null)
  const needsTarget = total > 0

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Удалить этап «{stage.name}»?</DialogTitle>
        <DialogDescription>
          {needsTarget
            ? `На этапе ${formatNumber(total)} ${pluralize(total, ["сделка", "сделки", "сделок"])} (в работе — ${formatNumber(stage.openDeals ?? 0)}). Выберите, куда их перенести: переход запишется в историю каждой сделки, а этап уйдёт в архив.`
            : "Сделок на этапе нет. Этап будет удалён; у менеджеров отдела он пропадёт из воронки."}
        </DialogDescription>
      </DialogHeader>
      {needsTarget && (
        <div className="grid gap-1.5">
          <Label htmlFor="move-target">Перенести сделки на этап</Label>
          <Select items={targets.map((item) => ({ value: item.id, label: item.name }))} value={target} onValueChange={setTarget}>
            <SelectTrigger id="move-target" className="w-full">
              <SelectValue placeholder="Выберите этап" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button variant="destructive" disabled={isPending || (needsTarget && !target)} onClick={() => onConfirm(stage, needsTarget ? target : null)}>
          {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
          {needsTarget ? "Перенести и удалить" : "Удалить этап"}
        </Button>
      </DialogFooter>
    </div>
  )
}

/** Название воронки: его видят менеджеры во вкладках «Продаж» */
function FunnelNameForm({ name, isPending, onRename }: { name: string; isPending: boolean; onRename: (name: string) => void }) {
  const [value, setValue] = useState(name)
  const changed = value.trim() !== name && value.trim().length > 0
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (changed) onRename(value.trim())
      }}
    >
      <div className="grid min-w-0 flex-1 gap-1.5">
        <Label htmlFor="funnel-name">Название воронки</Label>
        <Input id="funnel-name" value={value} onChange={(event) => setValue(event.target.value)} maxLength={100} className="h-8" />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={!changed || isPending}>
        <Check data-icon="inline-start" aria-hidden />
        Переименовать
      </Button>
    </form>
  )
}
