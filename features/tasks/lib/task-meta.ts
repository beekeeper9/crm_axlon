import { ListTodo, Mail, Phone, Users, type LucideIcon } from "lucide-react"

import type { TaskDueGroup, TaskType } from "@/features/tasks/schemas"
import { formatDateTime, formatDayMonth } from "@/lib/format"

export const TASK_TYPE_META: Record<TaskType, { icon: LucideIcon; label: string }> = {
  call: { icon: Phone, label: "Звонок" },
  meeting: { icon: Users, label: "Встреча" },
  email: { icon: Mail, label: "Сообщение" },
  todo: { icon: ListTodo, label: "Задача" },
}

/** Срок без времени — дата задачи, назначенной на день */
export function isDateOnlyDue(dueAt: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dueAt)
}

export function formatTaskDue(dueAt: string): string {
  return isDateOnlyDue(dueAt) ? formatDayMonth(dueAt) : formatDateTime(dueAt)
}

/** Порядок групп по сроку; сами группы приходят от backend в поле dueGroup */
export const DUE_GROUPS: readonly { id: TaskDueGroup; label: string }[] = [
  { id: "overdue", label: "Просрочено" },
  { id: "today", label: "Сегодня" },
  { id: "tomorrow", label: "Завтра" },
  { id: "this_week", label: "На этой неделе" },
  { id: "next_week", label: "На следующей неделе" },
  { id: "later", label: "Позже" },
  { id: "no_due", label: "Без срока" },
]
