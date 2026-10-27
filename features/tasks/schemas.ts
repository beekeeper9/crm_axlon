import { z } from "zod"

/** Предлагаемая форма задачи. НЕ согласована с backend — см. docs/API_CONTRACT.md. */

export const taskTypeSchema = z.enum(["call", "meeting", "email", "todo"])

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: taskTypeSchema,
  dueAt: z.iso.datetime({ offset: true }),
  status: z.enum(["open", "done"]),
  /** Просрочку считает backend, чтобы не зависеть от часов браузера */
  isOverdue: z.boolean(),
  priority: z.enum(["high", "normal"]),
  relatedTo: z
    .object({
      kind: z.enum(["deal", "contact"]),
      name: z.string(),
    })
    .nullable(),
})

export const todayTasksSchema = z.object({
  date: z.iso.date(),
  tasks: z.array(taskSchema),
  /** Невыполненные задачи с прошлых дней */
  overdueFromPreviousDays: z.int().nonnegative(),
})

export type TaskType = z.infer<typeof taskTypeSchema>
export type Task = z.infer<typeof taskSchema>
export type TodayTasks = z.infer<typeof todayTasksSchema>
