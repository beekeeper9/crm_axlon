"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, CheckCheck, CircleCheck, Phone, Sparkles, Undo2 } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { ListGroup, ListPanel } from "@/components/shared/list-panel"
import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { leadRoute } from "@/config/routes"
import { AfterMeetingForm } from "@/features/after-meeting/components/after-meeting-form"
import type { AfterMeetingFormValues, AfterMeetingItem, AfterMeetingQueue } from "@/features/after-meeting/schemas"
import { useMediaQuery } from "@/hooks/use-media-query"
import { companyWallTimeToIso } from "@/lib/datetime"
import { formatDateTime, formatDecimalMoney } from "@/lib/format"
import type { EditMode } from "@/lib/permissions/edit-mode"
import { cn } from "@/lib/utils"

type Processed = { values: AfterMeetingFormValues }

type AfterMeetingWorkspaceProps = {
  queue: AfterMeetingQueue
  editMode: EditMode
  showHost: boolean
  isDemoData: boolean
}

/**
 * Очередь слева, обработка выбранного лида справа. На узком экране обработка
 * открывается выезжающей панелью — список остаётся на месте.
 */
export function AfterMeetingWorkspace({ queue, editMode, showHost, isDemoData }: AfterMeetingWorkspaceProps) {
  const isWide = useMediaQuery("(min-width: 1024px)")
  const allItems = queue.groups.flatMap((group) => group.items)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [processed, setProcessed] = useState<ReadonlyMap<string, Processed>>(new Map())

  // На широком экране сразу открыт первый необработанный лид
  const effectiveId = selectedId ?? (isWide ? (allItems.find((item) => !processed.has(item.id))?.id ?? null) : null)
  const selected = allItems.find((item) => item.id === effectiveId) ?? null
  const remaining = allItems.filter((item) => !processed.has(item.id)).length

  function submit(item: AfterMeetingItem, values: AfterMeetingFormValues) {
    setProcessed((current) => new Map(current).set(item.id, { values }))
    const next = allItems.find((candidate) => candidate.id !== item.id && !processed.has(candidate.id))
    setSelectedId(isWide ? (next?.id ?? item.id) : null)
  }

  function undo(itemId: string) {
    setProcessed((current) => {
      const next = new Map(current)
      next.delete(itemId)
      return next
    })
  }

  if (allItems.length === 0) {
    return (
      <ListPanel>
        <EmptyState icon={CheckCheck} title="После встреч всё обработано" description="Итоги записаны, у каждого лида есть следующий шаг." />
      </ListPanel>
    )
  }

  const detail = selected && (
    <ItemDetail
      key={selected.id}
      item={selected}
      processed={processed.get(selected.id) ?? null}
      editMode={editMode}
      isDemoData={isDemoData}
      onSubmit={(values) => submit(selected, values)}
      onUndo={() => undo(selected.id)}
    />
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] lg:items-start">
      <div className="min-w-0 space-y-2">
        <p className="text-meta text-muted-foreground" aria-live="polite">
          {remaining > 0 ? `Осталось обработать: ${remaining}` : "Все лиды в очереди обработаны"}
        </p>
        <ListPanel>
          {queue.groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <ListGroup
                key={group.id}
                id={`after-${group.id}`}
                title={group.title}
                count={group.items.filter((item) => !processed.has(item.id)).length}
                tone={group.id === "outcome_required" ? "warning" : "default"}
              >
                {group.items.map((item) => (
                  <QueueRow
                    key={item.id}
                    item={item}
                    isSelected={item.id === effectiveId}
                    isProcessed={processed.has(item.id)}
                    showHost={showHost}
                    onSelect={() => setSelectedId(item.id)}
                  />
                ))}
              </ListGroup>
            ))}
        </ListPanel>
      </div>

      {isWide ? (
        <div className="rounded-xl bg-card ring-1 ring-border lg:sticky lg:top-20">{detail}</div>
      ) : (
        <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
            {selected && <SheetTitle className="sr-only">{selected.lead.name}</SheetTitle>}
            {detail}
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

function QueueRow({
  item,
  isSelected,
  isProcessed,
  showHost,
  onSelect,
}: {
  item: AfterMeetingItem
  isSelected: boolean
  isProcessed: boolean
  showHost: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={isSelected ? "true" : undefined}
        className={cn(
          "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none",
          isSelected && "bg-accent shadow-[inset_2px_0_0_var(--primary)]"
        )}
      >
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-medium", isProcessed && "text-muted-foreground line-through")}>{item.lead.name}</p>
          <p className="truncate text-meta text-muted-foreground">
            {formatDateTime(item.meeting.startsAt)} · {item.stageName}
            {showHost && ` · ${item.meeting.host.name}`}
          </p>
        </div>
        {isProcessed && <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-label="Обработано" />}
      </button>
    </li>
  )
}

type ItemDetailProps = {
  item: AfterMeetingItem
  processed: Processed | null
  editMode: EditMode
  isDemoData: boolean
  onSubmit: (values: AfterMeetingFormValues) => void
  onUndo: () => void
}

const RESULT_LABELS = { held: "Встреча состоялась", no_show: "Клиент не дошёл", rescheduled: "Встреча перенесена" } as const

function ItemDetail({ item, processed, editMode, isDemoData, onSubmit, onUndo }: ItemDetailProps) {
  return (
    <div className="space-y-4 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3 pr-8 lg:pr-0">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-base font-semibold">{item.lead.name}</h2>
          <p className="text-meta text-muted-foreground">
            {item.stageName} · {item.pipelineName}
            {item.amount && item.currency && ` · ${formatDecimalMoney(item.amount, item.currency)}`}
          </p>
          <p className="text-meta text-muted-foreground">Встреча {formatDateTime(item.meeting.startsAt)} · проводил(а) {item.meeting.host.name}</p>
        </div>
        <div className="flex gap-2">
          {item.lead.phone && (
            <a href={`tel:${item.lead.phone.replace(/[^\d+]/g, "")}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Phone data-icon="inline-start" aria-hidden />
              Позвонить
            </a>
          )}
          <Link href={leadRoute(item.lead.id)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Карточка
            <ArrowUpRight data-icon="inline-end" aria-hidden />
          </Link>
        </div>
      </header>

      {(item.meeting.outcomeComment || item.nextAction) && (
        <dl className="grid gap-2 rounded-lg bg-muted/35 p-3 text-meta sm:grid-cols-2">
          {item.meeting.outcomeComment && (
            <div>
              <dt className="text-xs text-muted-foreground">Итог встречи</dt>
              <dd>{item.meeting.outcomeComment}</dd>
            </div>
          )}
          {item.nextAction && (
            <div>
              <dt className="text-xs text-muted-foreground">Текущий следующий шаг</dt>
              <dd>
                {item.nextAction.title}
                {item.nextAction.dueAt && <span className="text-muted-foreground"> · {formatDateTime(item.nextAction.dueAt)}</span>}
              </dd>
            </div>
          )}
        </dl>
      )}

      {item.aiHint && (
        <p className="flex items-start gap-2 text-meta">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-medium text-primary">Подсказка ИИ{isDemoData && " · демо"}:</span> {item.aiHint}
          </span>
        </p>
      )}

      {processed ? (
        <ProcessedSummary values={processed.values} onUndo={onUndo} />
      ) : (
        <AfterMeetingForm item={item} editMode={editMode} onSubmit={onSubmit} />
      )}
    </div>
  )
}

function ProcessedSummary({ values, onUndo }: { values: AfterMeetingFormValues; onUndo: () => void }) {
  return (
    <div role="status" className="space-y-2 rounded-lg border border-success/30 bg-success/8 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-success">
        <CircleCheck className="size-4" aria-hidden />
        Обработано в демо-режиме — на сервере не сохранено
      </p>
      <ul className="space-y-1 text-meta text-foreground/90">
        {values.result && (
          <li>
            {RESULT_LABELS[values.result]}
            {values.result === "rescheduled" && values.rescheduledTo && ` на ${formatDateTime(companyWallTimeToIso(values.rescheduledTo))}`}
          </li>
        )}
        {values.summary && <li>Итог: {values.summary}</li>}
        {values.agreements && <li>Договорённости: {values.agreements}</li>}
        <li>
          {values.nextTitle
            ? `Задача: ${values.nextTitle} · ${formatDateTime(companyWallTimeToIso(values.nextDueAt))}`
            : "Следующий шаг не назначен"}
        </li>
      </ul>
      <Button variant="ghost" size="sm" onClick={onUndo}>
        <Undo2 data-icon="inline-start" aria-hidden />
        Отменить
      </Button>
    </div>
  )
}
