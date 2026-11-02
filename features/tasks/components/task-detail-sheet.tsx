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
import { TASK_TYPE_META, formatTaskDue } from "@/features/tasks/lib/task-meta"
import type { Task } from "@/features/tasks/schemas"
import { formatDateTime } from "@/lib/format"
import { EDIT_UNAVAILABLE_HINT, type EditMode } from "@/lib/permissions/edit-mode"

type TaskDetailSheetProps = {
  task: Task | null
  editMode: EditMode
  isDemoChanged: boolean
  /** Выполнение работает (в демо или через backend), даже когда правка задачи недоступна */
  canComplete: boolean
  onOpenChange: (open: boolean) => void
  /** Через backend — сообщение об ошибке или null при успехе */
  onComplete: (task: Task, result: string) => void | Promise<string | null>
  onEdit: (task: Task) => void
  onTake: (task: Task) => void
  /** Через backend: отменить открытую или вернуть выполненную задачу; сообщение об ошибке или null */
  onChangeState?: (task: Task, action: "cancel" | "reopen") => Promise<string | null>
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

function TaskDetail({ task, editMode, isDemoChanged, canComplete, onComplete, onEdit, onTake, onChangeState }: Omit<TaskDetailSheetProps, "task" | "onOpenChange"> & { task: Task }) {
  const [result, setResult] = useState("")
  const [isCompleting, setIsCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isDone = task.status === "done"

  function changeState(action: "cancel" | "reopen") {
    if (!onChangeState) return
    setIsCompleting(true)
    setError(null)
    void onChangeState(task, action).then((message) => {
      setError(message)
      setIsCompleting(false)
    })
  }
  const canEdit = editMode === "demo" || (editMode === "unavailable" && canComplete)
  const disabledTitle = editMode === "unavailable" ? EDIT_UNAVAILABLE_HINT : undefined

  function complete() {
    const completing = onComplete(task, result.trim())
    if (!completing) return
    setIsCompleting(true)
    setError(null)
    void completing.then((message) => {
      setIsCompleting(false)
      setError(message)
    })
  }
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
          <DetailRow label="Срок">{task.dueAt ? formatTaskDue(task.dueAt) : "Без срока"}</DetailRow>
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
                disabled={!canComplete || isCompleting}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={complete}
                disabled={!canComplete || isCompleting}
                aria-busy={isCompleting}
                title={canComplete ? undefined : disabledTitle}
              >
                <CircleCheck data-icon="inline-start" aria-hidden />
                {isCompleting ? "Сохраняем…" : "Выполнить"}
              </Button>
              <Button variant="outline" onClick={() => onEdit(task)} disabled={!canEdit} title={disabledTitle}>
                <Pencil data-icon="inline-start" aria-hidden />
                Изменить
              </Button>
              {onChangeState && (
                <Button variant="ghost" onClick={() => changeState("cancel")} disabled={isCompleting}>
                  Отменить задачу
                </Button>
              )}
              {task.assignee === null && (
                <Button variant="outline" onClick={() => onTake(task)} disabled={editMode !== "demo"} title={disabledTitle}>
                  <Hand data-icon="inline-start" aria-hidden />
                  Взять себе
                </Button>
              )}
            </div>
          </div>
        )}

        {isDone && onChangeState && (
          <Button variant="outline" onClick={() => changeState("reopen")} disabled={isCompleting}>
            Вернуть в работу
          </Button>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {editMode === "unavailable" && !canComplete && <p className="text-xs text-muted-foreground">{EDIT_UNAVAILABLE_HINT}.</p>}
        {(isDemoChanged || editMode === "demo") && (
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
