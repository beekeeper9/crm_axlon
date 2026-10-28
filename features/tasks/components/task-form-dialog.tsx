"use client"

import { useState } from "react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TASK_TYPE_META } from "@/features/tasks/lib/task-meta"
import { taskFormSchema, taskTypeSchema, type Task, type TaskFormValues } from "@/features/tasks/schemas"
import { isoToCompanyWallTime } from "@/lib/datetime"

type Member = { id: string; name: string }

type TaskFormDialogProps = {
  open: boolean
  /** Задача для редактирования; null — новая */
  task: Task | null
  leadName: string | null
  members: readonly Member[]
  /** Ставить задачи другим может руководитель; менеджер ставит себе */
  canAssign: boolean
  currentUser: Member
  onOpenChange: (open: boolean) => void
  onSave: (values: TaskFormValues) => void
}

export function TaskFormDialog({ open, onOpenChange, ...props }: TaskFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <TaskForm key={props.task?.id ?? "new"} onCancel={() => onOpenChange(false)} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

type FieldErrors = Partial<Record<keyof TaskFormValues, string>>

function TaskForm({
  task,
  leadName,
  members,
  canAssign,
  currentUser,
  onSave,
  onCancel,
}: Omit<TaskFormDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const [values, setValues] = useState<TaskFormValues>(() => ({
    title: task?.title ?? "",
    type: task?.type ?? "call",
    dueAt: task?.dueAt ? isoToCompanyWallTime(task.dueAt) : "",
    priority: task?.priority ?? "normal",
    assigneeId: task ? (task.assignee?.id ?? null) : currentUser.id,
    description: task?.description ?? "",
  }))
  const [errors, setErrors] = useState<FieldErrors>({})

  function set<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = taskFormSchema.safeParse(values)
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof TaskFormValues
        next[key] ??= issue.message
      }
      setErrors(next)
      return
    }
    onSave(parsed.data)
  }

  const assigneeOptions = [{ value: "none", label: "Без исполнителя" }, ...members.map((member) => ({ value: member.id, label: member.name }))]
  const typeOptions = taskTypeSchema.options.map((type) => ({ value: type, label: TASK_TYPE_META[type].label }))

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{task ? "Изменить задачу" : "Новая задача"}</DialogTitle>
        {leadName && <DialogDescription>По лиду «{leadName}»</DialogDescription>}
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="task-title">Что сделать</Label>
        <Input
          id="task-title"
          value={values.title}
          onChange={(event) => set("title", event.target.value)}
          placeholder="Например: перезвонить и согласовать дату оплаты"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "task-title-error" : undefined}
          autoFocus
        />
        {errors.title && <p id="task-title-error" className="text-xs text-destructive">{errors.title}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="task-type">Тип</Label>
          <Select items={typeOptions} value={values.type} onValueChange={(type) => type && set("type", taskTypeSchema.parse(type))}>
            <SelectTrigger id="task-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="task-due">Срок</Label>
          <Input
            id="task-due"
            type="datetime-local"
            value={values.dueAt}
            onChange={(event) => set("dueAt", event.target.value)}
            aria-invalid={Boolean(errors.dueAt)}
            aria-describedby={errors.dueAt ? "task-due-error" : undefined}
          />
          {errors.dueAt && <p id="task-due-error" className="text-xs text-destructive">{errors.dueAt}</p>}
        </div>
      </div>

      {canAssign && (
        <div className="grid gap-2">
          <Label htmlFor="task-assignee">Исполнитель</Label>
          <Select
            items={assigneeOptions}
            value={values.assigneeId ?? "none"}
            onValueChange={(id) => set("assigneeId", !id || id === "none" ? null : id)}
          >
            <SelectTrigger id="task-assignee" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assigneeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.priority === "high"}
          onChange={(event) => set("priority", event.target.checked ? "high" : "normal")}
          className="size-4 accent-(--primary)"
        />
        Важная задача
      </label>

      <div className="grid gap-2">
        <Label htmlFor="task-description">Подробности</Label>
        <Textarea
          id="task-description"
          value={values.description}
          onChange={(event) => set("description", event.target.value)}
          rows={3}
          aria-invalid={Boolean(errors.description)}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
      </div>

      <DemoNotice>Демо-режим: задача появится только на этой странице и не сохранится на сервере.</DemoNotice>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit">{task ? "Сохранить" : "Создать задачу"}</Button>
      </DialogFooter>
    </form>
  )
}
