"use client"

import { useState } from "react"
import { Check, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"

import { DemoNotice } from "@/components/shared/demo-notice"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { PipelineStage } from "@/features/sales"
import { useStageMove } from "@/features/sales/components/stage-move-dialog"
import { EDIT_UNAVAILABLE_HINT, type EditMode } from "@/lib/permissions/edit-mode"

type LeadStageControlProps = {
  pipelineName: string
  stages: readonly PipelineStage[]
  stageId: string
  editMode: EditMode
  /** Режим api: этап меняется на сервере у этой сделки */
  serverDealId?: string | null
  /** Статус сделки от backend; после «Открыть снова» он open, хотя этап может остаться закрывающим */
  isOpenDeal?: boolean
  /** Название сделки — для окон «Следующий шаг» и «Встреча перенесена» */
  dealTitle?: string
}

/** Путь по воронке: пройденные этапы, текущий и следующие. Этапы берутся из настроек воронки. */
export function LeadStageControl({
  pipelineName,
  stages,
  stageId: initialStageId,
  editMode,
  serverDealId = null,
  isOpenDeal,
  dealTitle = "Сделка",
}: LeadStageControlProps) {
  const stageMove = useStageMove()
  const { isPending, failure } = stageMove
  const [demoStageId, setStageId] = useState(initialStageId)
  const isServer = serverDealId !== null && editMode === "unavailable"
  // Через backend текущий этап — всегда ответ сервера (после router.refresh приходит новый)
  const stageId = isServer ? initialStageId : demoStageId
  const openStages = stages.filter((stage) => stage.kind === "open")
  const current = stages.find((stage) => stage.id === stageId)
  const currentIndex = openStages.findIndex((stage) => stage.id === stageId)
  const isOnClosingStage = current !== undefined && current.kind !== "open"
  const isClosed = isServer && isOpenDeal !== undefined ? !isOpenDeal : isOnClosingStage
  const needsStage = !isClosed && isOnClosingStage
  const canEdit = (editMode === "demo" || isServer) && !isClosed && !isPending

  function select(nextStageId: string) {
    if (!isServer || !serverDealId) return setStageId(nextStageId)
    const stage = stages.find((item) => item.id === nextStageId)
    if (stage) stageMove.move(serverDealId, dealTitle, stage)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Воронка «{pipelineName}»</span>
        {isClosed && current && (
          <StatusBadge tone={current.kind === "won" ? "success" : "danger"}>{current.name}</StatusBadge>
        )}
      </div>
      <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Этапы сделки">
        {openStages.map((stage, index) => {
          const isCurrent = stage.id === stageId
          const isPassed = !isClosed && index < currentIndex
          return (
            <li key={stage.id} className="min-w-28 flex-1">
              <button
                type="button"
                disabled={!canEdit || isCurrent}
                title={editMode === "unavailable" && !isServer ? EDIT_UNAVAILABLE_HINT : stage.name}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => select(stage.id)}
                className={cn(
                  "group/stage flex w-full flex-col gap-1.5 rounded-md px-1 py-1 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none enabled:hover:bg-muted/60 disabled:cursor-default",
                  isCurrent ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 rounded-full",
                    isCurrent ? "bg-primary" : isPassed ? "bg-primary/45" : "bg-muted"
                  )}
                  aria-hidden
                />
                <span className="flex items-center gap-1 truncate">
                  {isPassed && <Check className="size-3 shrink-0 text-primary" aria-hidden />}
                  <span className="truncate">{stage.name}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {needsStage && <p className="text-meta text-warning">Сделка открыта снова — выберите этап, на котором продолжается работа.</p>}
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      {stageMove.dialog}
      {!isServer && stageId !== initialStageId && (
        <DemoNotice className="items-center">
          <span className="flex flex-wrap items-center gap-x-2">
            Этап изменён только на этой странице (демо-режим), на сервере ничего не сохранено.
            <Button variant="ghost" size="xs" onClick={() => setStageId(initialStageId)}>
              <Undo2 data-icon="inline-start" aria-hidden />
              Вернуть
            </Button>
          </span>
        </DemoNotice>
      )}
    </div>
  )
}
