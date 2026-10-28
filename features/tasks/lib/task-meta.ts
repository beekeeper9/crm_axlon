import { ListTodo, Mail, Phone, Users, type LucideIcon } from "lucide-react"

import type { TaskDueGroup, TaskType } from "@/features/tasks/schemas"

export const TASK_TYPE_META: Record<TaskType, { icon: LucideIcon; label: string }> = {
  call: { icon: Phone, label: "Звонок" },
  meeting: { icon: Users, label: "Встреча" },
  email: { icon: Mail, label: "Сообщение" },
  todo: { icon: ListTodo, label: "Задача" },
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
