"use client"

import { useState } from "react"
import { Inbox, Undo2 } from "lucide-react"
import { cn } from "cn"

import { DemoNotice } from "@/components/shared/demo-notice"
import { Button } from "@/components/ui/button"
import { CloseDealDialog, type CloseDealResult } from "@/features/sales/components/close-deal-dialog"
import { DealCard } from "@/features/sales/components/deal-card"
import { findDeal, moveDeal } from "@/features/sales/lib/board-state"
import type { Board, BoardColumn, Deal, LossReason, Pipeline } from "@/features/sales/schemas"
import { formatDecimalMoney, formatNumber } from "@/lib/format"
import type { EditMode } from "@/lib/permissions/edit-mode"


type PipelineBoardProps = {
  board: Board
  pipeline: Pipeline
  lossReasons: readonly LossReason[]
  showManager: boolean
  editMode: EditMode
}

type LastChange = {
  dealTitle: string
  stageName: string
  previous: BoardColumn[]
}

export function PipelineBoard({ board, pipeline, lossReasons, showManager, editMode }: PipelineBoardProps) {
  const [columns, setColumns] = useState(board.columns)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [closingDeal, setClosingDeal] = useState<Deal | null>(null)
  const [lastChange, setLastChange] = useState<LastChange | null>(null)

  const canEdit = editMode === "demo"
  const stagesById = new Map(pipeline.stages.map((stage) => [stage.id, stage]))
  const openStages = pipeline.stages.filter((stage) => stage.kind === "open")

  function applyMove(dealId: string, stageId: string) {
    const deal = findDeal(columns, dealId)
    const stage = stagesById.get(stageId)
    if (!deal || !stage || deal.stageId === stageId) return
    setLastChange({ dealTitle: deal.title, stageName: stage.name, previous: columns })
    setColumns(moveDeal(columns, dealId, stageId))
  }

  function handleClose({ dealId, stageId }: CloseDealResult) {
    applyMove(dealId, stageId)
    setClosingDeal(null)
  }

  return (
    <div className="space-y-3">
      {editMode === "unavailable" && (
        <p className="text-xs text-muted-foreground">
          Смена этапа станет доступна после согласования API с backend.
        </p>
      )}
      {canEdit && !lastChange && (
        <p className="text-xs text-muted-foreground max-md:hidden">
          Перетащите карточку на другой этап или выберите этап в меню карточки.
        </p>
      )}
      <div aria-live="polite">
        {lastChange && (
          <DemoNotice className="items-center">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                «{lastChange.dealTitle}» → {lastChange.stageName}. Демо-режим: изменение не сохранено и пропадёт после обновления страницы.
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setColumns(lastChange.previous)
                  setLastChange(null)
                }}
              >
                <Undo2 data-icon="inline-start" aria-hidden />
                Отменить
              </Button>
            </span>
          </DemoNotice>
        )}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <ol className="flex min-w-max gap-3" aria-label={`Этапы воронки «${pipeline.name}»`}>
          {columns.map((column) => {
            const stage = stagesById.get(column.stageId)
            if (!stage) return null
            const isDropTarget = dropTarget === column.stageId && draggedId !== null
            return (
              <li
                key={column.stageId}
                className="flex w-72 shrink-0 flex-col"
                onDragOver={(event) => {
                  if (!canEdit || !draggedId) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"
                  setDropTarget(column.stageId)
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  const dealId = event.dataTransfer.getData("text/plain")
                  if (dealId) applyMove(dealId, column.stageId)
                  setDropTarget(null)
                  setDraggedId(null)
                }}
              >
                <header className="mb-2 space-y-0.5 px-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate text-sm font-semibold">{stage.name}</h2>
                    <span className="rounded-md bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                      {formatNumber(column.count)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {column.totalAmount && column.currency
                      ? formatDecimalMoney(column.totalAmount, column.currency)
                      : "Сумма не указана"}
                  </p>
                </header>
                <ul
                  className={cn(
                    "flex min-h-32 flex-1 flex-col gap-2 rounded-xl p-1.5 transition-colors md:max-h-[calc(100svh-17rem)] md:overflow-y-auto",
                    isDropTarget ? "bg-primary/10 ring-2 ring-primary/40" : "bg-muted/40"
                  )}
                >
                  {column.deals.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      openStages={openStages}
                      showManager={showManager}
                      canEdit={canEdit}
                      isDragging={draggedId === deal.id}
                      onDragStart={setDraggedId}
                      onDragEnd={() => {
                        setDraggedId(null)
                        setDropTarget(null)
                      }}
                      onMove={applyMove}
                      onClose={setClosingDeal}
                    />
                  ))}
                  {column.deals.length === 0 && (
                    <li className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                      <Inbox className="size-4" aria-hidden />
                      Нет сделок
                    </li>
                  )}
                </ul>
              </li>
            )
          })}
        </ol>
      </div>

      <CloseDealDialog
        deal={closingDeal}
        wonStage={pipeline.stages.find((stage) => stage.kind === "won")}
        lostStage={pipeline.stages.find((stage) => stage.kind === "lost")}
        lossReasons={lossReasons}
        isDemo={editMode === "demo"}
        onOpenChange={(open) => !open && setClosingDeal(null)}
        onConfirm={handleClose}
      />
    </div>
  )
}
