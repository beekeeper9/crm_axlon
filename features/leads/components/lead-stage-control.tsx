"use client"

import { useState } from "react"
import { Check, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"

import { DemoNotice } from "@/components/shared/demo-notice"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { PipelineStage } from "@/features/sales"
import { EDIT_UNAVAILABLE_HINT, type EditMode } from "@/lib/permissions/edit-mode"

type LeadStageControlProps = {
  pipelineName: string
  stages: readonly PipelineStage[]
  stageId: string
  editMode: EditMode
}

/** Путь по воронке: пройденные этапы, текущий и следующие. Этапы берутся из настроек воронки. */
export function LeadStageControl({ pipelineName, stages, stageId: initialStageId, editMode }: LeadStageControlProps) {
  const [stageId, setStageId] = useState(initialStageId)
  const openStages = stages.filter((stage) => stage.kind === "open")
  const current = stages.find((stage) => stage.id === stageId)
  const currentIndex = openStages.findIndex((stage) => stage.id === stageId)
  const isClosed = current !== undefined && current.kind !== "open"
  const canEdit = editMode === "demo"

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
                title={editMode === "unavailable" ? EDIT_UNAVAILABLE_HINT : stage.name}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => setStageId(stage.id)}
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
      {stageId !== initialStageId && (
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
