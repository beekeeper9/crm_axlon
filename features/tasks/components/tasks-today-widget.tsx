import Link from "next/link"
import {
  ArrowRight,
  CalendarCheck,
  CircleCheck,
  ListTodo,
  Mail,
  Phone,
  Users,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { WidgetCard } from "@/components/shared/widget-card"
import { buttonVariants } from "@/components/ui/button"
import { routes } from "@/config/routes"
import { tasksRepository } from "@/features/tasks/api/tasks-repository"
import type { TaskType } from "@/features/tasks/schemas"
import { formatNumber, formatTime } from "@/lib/format"

export const TASKS_TODAY_TITLE = "Задачи на сегодня"

const TYPE_META: Record<TaskType, { icon: LucideIcon; label: string }> = {
  call: { icon: Phone, label: "Звонок" },
  meeting: { icon: Users, label: "Встреча" },
  email: { icon: Mail, label: "Письмо" },
  todo: { icon: ListTodo, label: "Задача" },
}

export async function TasksTodayWidget() {
  const { tasks, overdueFromPreviousDays } = await tasksRepository.getTodayTasks()

  const doneCount = tasks.filter((task) => task.status === "done").length
  const overdueCount =
    overdueFromPreviousDays +
    tasks.filter((task) => task.status === "open" && task.isOverdue).length

  return (
    <WidgetCard
      title={TASKS_TODAY_TITLE}
      description={`Выполнено ${formatNumber(doneCount)} из ${formatNumber(tasks.length)}`}
      action={
        overdueCount > 0 && (
          <StatusBadge tone="danger">Просрочено: {formatNumber(overdueCount)}</StatusBadge>
        )
      }
      contentClassName="flex flex-col"
    >
      {tasks.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="На сегодня задач нет"
          description="Запланируйте звонки и встречи, чтобы сделки двигались дальше."
        />
      ) : (
        <ul className="-my-2 flex-1 divide-y">
          {tasks.map((task) => {
            const type = TYPE_META[task.type]
            const isDone = task.status === "done"
            const Icon = isDone ? CircleCheck : type.icon
            return (
              <li key={task.id} className="flex gap-3 py-2.5">
                <time
                  dateTime={task.dueAt ?? undefined}
                  className={cn(
                    "w-10 shrink-0 pt-px text-xs font-medium",
                    task.isOverdue && !isDone ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {task.dueAt ? formatTime(task.dueAt) : "—"}
                </time>
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    isDone ? "text-success" : "text-muted-foreground"
                  )}
                  aria-label={isDone ? "Выполнено" : type.label}
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p
                    className={cn(
                      "text-sm",
                      isDone ? "text-muted-foreground line-through" : "font-medium"
                    )}
                  >
                    {task.title}
                  </p>
                  {(task.lead || (task.isOverdue && !isDone)) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {task.lead && <span className="truncate">{task.lead.name}</span>}
                      {task.isOverdue && !isDone && (
                        <span className="font-medium text-destructive">Просрочена</span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Link
        href={routes.tasks}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-3 self-start")}
      >
        Все задачи
        <ArrowRight data-icon="inline-end" aria-hidden />
      </Link>
    </WidgetCard>
  )
}
