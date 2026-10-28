"use client"

import Link from "next/link"
import { Circle, CircleCheck, Flag } from "lucide-react"
import { cn } from "cn"

import { PersonAvatar } from "@/components/shared/person-avatar"
import { leadRoute } from "@/config/routes"
import { TASK_TYPE_META } from "@/features/tasks/lib/task-meta"
import type { Task } from "@/features/tasks/schemas"
import { formatDateTime } from "@/lib/format"

type TaskRowProps = {
  task: Task
  showAssignee: boolean
  showLead: boolean
  isDemoChanged: boolean
  canComplete: boolean
  onOpen: (task: Task) => void
  onComplete: (task: Task) => void
}

export function TaskRow({ task, showAssignee, showLead, isDemoChanged, canComplete, onOpen, onComplete }: TaskRowProps) {
  const type = TASK_TYPE_META[task.type]
  const isDone = task.status === "done"

  return (
    <li className="group/task flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
      <button
        type="button"
        disabled={!canComplete || isDone}
        onClick={() => onComplete(task)}
        aria-label={isDone ? "Задача выполнена" : `Выполнить: ${task.title}`}
        className={cn(
          "mt-0.5 shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:cursor-default",
          isDone ? "text-success" : "text-muted-foreground hover:text-success"
        )}
      >
        {isDone ? <CircleCheck className="size-4" aria-hidden /> : <Circle className="size-4" aria-hidden />}
      </button>

      <div className="min-w-0 flex-1 space-y-0.5">
        <button
          type="button"
          onClick={() => onOpen(task)}
          className={cn(
            "text-left text-sm hover:text-primary focus-visible:text-primary focus-visible:outline-none",
            isDone ? "text-muted-foreground line-through" : "font-medium"
          )}
        >
          {task.title}
        </button>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <type.icon className="size-3" aria-hidden />
            {type.label}
          </span>
          {showLead && task.lead && (
            <Link href={leadRoute(task.lead.id)} className="truncate hover:text-foreground hover:underline">
              {task.lead.name}
            </Link>
          )}
          {task.assignee === null && <span className="font-medium text-warning">Без исполнителя</span>}
          {isDemoChanged && <span className="text-warning">демо · не сохранено</span>}
        </div>
      </div>

      {task.priority === "high" && !isDone && (
        <Flag className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-label="Важная" />
      )}
      <time
        dateTime={task.dueAt ?? undefined}
        className={cn(
          "w-28 shrink-0 pt-px text-right text-xs tabular-nums",
          task.isOverdue && !isDone ? "font-medium text-destructive" : "text-muted-foreground"
        )}
      >
        {task.dueAt ? formatDateTime(task.dueAt) : "без срока"}
      </time>
      {showAssignee && (task.assignee ? <PersonAvatar name={task.assignee.name} /> : <span className="size-5 shrink-0" />)}
    </li>
  )
}
