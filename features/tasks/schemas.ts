import { z } from "zod"

/** Предлагаемая форма задачи. НЕ согласована с backend — см. docs/API_CONTRACT.md. */

const refSchema = z.object({ id: z.string(), name: z.string() })

export const taskTypeSchema = z.enum(["call", "meeting", "email", "todo"])
export const taskPrioritySchema = z.enum(["high", "normal"])
export const taskStatusSchema = z.enum(["open", "done"])

/**
 * Группа по сроку считается на backend в часовом поясе компании
 * (просрочено, сегодня, завтра, эта неделя, следующая неделя, позже, без срока).
 */
export const taskDueGroupSchema = z.enum([
  "overdue",
  "today",
  "tomorrow",
  "this_week",
  "next_week",
  "later",
  "no_due",
])

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: taskTypeSchema,
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  /** Просрочку считает backend, чтобы не зависеть от часов браузера */
  isOverdue: z.boolean(),
  /** null у выполненных задач */
  dueGroup: taskDueGroupSchema.nullable(),
  /** null — задача без исполнителя («ничья»), её можно взять */
  assignee: refSchema.nullable(),
  createdBy: refSchema,
  lead: refSchema.nullable(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  /** Результат, с которым закрыта задача */
  result: z.string().nullable(),
})

export const todayTasksSchema = z.object({
  date: z.iso.date(),
  tasks: z.array(taskSchema),
  /** Невыполненные задачи с прошлых дней */
  overdueFromPreviousDays: z.int().nonnegative(),
})

/** Форма создания и редактирования (проверка на клиенте; окончательно проверяет backend) */
export const taskFormSchema = z.object({
  title: z.string().trim().min(3, "Опишите задачу — хотя бы 3 символа").max(200, "Не длиннее 200 символов"),
  type: taskTypeSchema,
  dueAt: z.string().min(1, "Укажите срок"),
  priority: taskPrioritySchema,
  assigneeId: z.string().nullable(),
  description: z.string().trim().max(2000, "Не длиннее 2000 символов"),
})

export type TaskType = z.infer<typeof taskTypeSchema>
export type TaskPriority = z.infer<typeof taskPrioritySchema>
export type TaskStatus = z.infer<typeof taskStatusSchema>
export type TaskDueGroup = z.infer<typeof taskDueGroupSchema>
export type Task = z.infer<typeof taskSchema>
export type TodayTasks = z.infer<typeof todayTasksSchema>
export type TaskFormValues = z.infer<typeof taskFormSchema>
