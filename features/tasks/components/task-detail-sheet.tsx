"use client"

import { useState } from "react"
import Link from "next/link"
import { CircleCheck, Hand, Pencil } from "lucide-react"

import { DemoNotice } from "@/components/shared/demo-notice"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { leadRoute } from "@/config/routes"
import { TASK_TYPE_META } from "@/features/tasks/lib/task-meta"
import type { Task } from "@/features/tasks/schemas"
import { formatDateTime } from "@/lib/format"
import { EDIT_UNAVAILABLE_HINT, type EditMode } from "@/lib/permissions/edit-mode"

type TaskDetailSheetProps = {
  task: Task | null
  editMode: EditMode
  isDemoChanged: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (task: Task, result: string) => void
  onEdit: (task: Task) => void
  onTake: (task: Task) => void
}

export function TaskDetailSheet({ task, onOpenChange, ...props }: TaskDetailSheetProps) {
  return (
    <Sheet open={task !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {task && <TaskDetail key={task.id} task={task} {...props} />}
      </SheetContent>
    </Sheet>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function TaskDetail({ task, editMode, isDemoChanged, onComplete, onEdit, onTake }: Omit<TaskDetailSheetProps, "task" | "onOpenChange"> & { task: Task }) {
  const [result, setResult] = useState("")
  const isDone = task.status === "done"
  const canEdit = editMode === "demo"
  const disabledTitle = editMode === "unavailable" ? EDIT_UNAVAILABLE_HINT : undefined
  const type = TASK_TYPE_META[task.type]

  return (
    <>
      <SheetHeader className="pr-10">
        <SheetDescription className="flex items-center gap-2">
          <type.icon className="size-3.5" aria-hidden />
          {type.label}
        </SheetDescription>
        <SheetTitle className="text-base leading-snug">{task.title}</SheetTitle>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {isDone ? (
            <StatusBadge tone="success">Выполнена</StatusBadge>
          ) : task.isOverdue ? (
            <StatusBadge tone="danger">Просрочена</StatusBadge>
          ) : (
            <StatusBadge tone="info">Открыта</StatusBadge>
          )}
          {task.priority === "high" && <StatusBadge tone="warning">Важная</StatusBadge>}
        </div>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-6">
        <dl className="divide-y">
          <DetailRow label="Срок">{task.dueAt ? formatDateTime(task.dueAt) : "Без срока"}</DetailRow>
          <DetailRow label="Исполнитель">{task.assignee?.name ?? <span className="text-warning">Не назначен</span>}</DetailRow>
          <DetailRow label="Поставил(а)">{task.createdBy.name}</DetailRow>
          <DetailRow label="Лид">
            {task.lead ? (
              <Link href={leadRoute(task.lead.id)} className="text-primary hover:underline">
                {task.lead.name}
              </Link>
            ) : (
              <span className="text-muted-foreground">Без привязки</span>
            )}
          </DetailRow>
          {task.completedAt && <DetailRow label="Выполнена">{formatDateTime(task.completedAt)}</DetailRow>}
        </dl>

        {task.description && <p className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-line">{task.description}</p>}

        {task.result && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Результат</p>
            <p className="text-sm">{task.result}</p>
          </div>
        )}

        {!isDone && editMode !== "read-only" && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="grid gap-2">
              <Label htmlFor="task-result">Результат</Label>
              <Textarea
                id="task-result"
                value={result}
                onChange={(event) => setResult(event.target.value)}
                rows={2}
                placeholder="Что получилось: например, клиент подтвердил оплату на пятницу"
                disabled={!canEdit}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onComplete(task, result.trim())} disabled={!canEdit} title={disabledTitle}>
                <CircleCheck data-icon="inline-start" aria-hidden />
                Выполнить
              </Button>
              <Button variant="outline" onClick={() => onEdit(task)} disabled={!canEdit} title={disabledTitle}>
                <Pencil data-icon="inline-start" aria-hidden />
                Изменить
              </Button>
              {task.assignee === null && (
                <Button variant="outline" onClick={() => onTake(task)} disabled={!canEdit} title={disabledTitle}>
                  <Hand data-icon="inline-start" aria-hidden />
                  Взять себе
                </Button>
              )}
            </div>
          </div>
        )}

        {editMode === "unavailable" && <p className="text-xs text-muted-foreground">{EDIT_UNAVAILABLE_HINT}.</p>}
        {(isDemoChanged || canEdit) && (
          <DemoNotice>
            {isDemoChanged
              ? "Эта задача изменена в демо-режиме: изменения не сохранены и пропадут после обновления страницы."
              : "Демо-режим: действия меняют задачу только на этой странице."}
          </DemoNotice>
        )}
      </div>
    </>
  )
}
