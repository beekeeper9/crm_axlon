import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { taskSchema, todayTasksSchema, type Task, type TaskType, type TodayTasks } from "@/features/tasks/schemas"
import { loadMemberNames } from "@/features/team"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { contractPending } from "@/lib/api/errors"
import { paginate, paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { getCurrentUser } from "@/lib/session/current-user"
import { simulateLatency } from "@/mocks/latency"
import { demoOwnScope } from "@/mocks/scope"
import { demoTasks, demoTodayTasksFor } from "@/mocks/tasks"

/** Значение фильтра исполнителя для задач без исполнителя */
export const UNASSIGNED = "none"

export type TasksQuery = PageParams & {
  status: "open" | "done" | "all"
  /** id сотрудника, UNASSIGNED или null — все доступные задачи */
  assigneeId: string | null
  leadId: string | null
  search: string | null
}

export type TasksRepository = {
  /** Задачи текущего пользователя на сегодня */
  getTodayTasks(): Promise<TodayTasks>
  listTasks(query: TasksQuery): Promise<Paginated<Task>>
}

const tasksPageSchema = paginatedSchema(taskSchema)

function matches(task: Task, { status, assigneeId, leadId, search }: TasksQuery): boolean {
  if (status !== "all" && task.status !== status) return false
  if (assigneeId === UNASSIGNED && task.assignee !== null) return false
  if (assigneeId && assigneeId !== UNASSIGNED && task.assignee?.id !== assigneeId) return false
  if (leadId && task.lead?.id !== leadId) return false
  if (!search) return true
  const needle = search.toLocaleLowerCase("ru")
  return [task.title, task.lead?.name ?? "", task.description ?? ""].some((value) =>
    value.toLocaleLowerCase("ru").includes(needle)
  )
}

const mockTasksRepository: TasksRepository = {
  async getTodayTasks() {
    await simulateLatency(550)
    // Демо-«backend» знает пользователя так же, как реальный знает его по токену
    const user = await getCurrentUser()
    return todayTasksSchema.parse(demoTodayTasksFor(user.id))
  },

  async listTasks({ limit, offset, ...requested }) {
    await simulateLatency(400)
    // Менеджеру — свои задачи и «ничьи», которые можно взять; чужие не приходят
    const ownScope = await demoOwnScope()
    const query =
      ownScope && requested.assigneeId !== UNASSIGNED
        ? { ...requested, assigneeId: requested.leadId ? requested.assigneeId : ownScope }
        : requested
    const tasks = demoTasks
      .filter((task) => !ownScope || task.assignee === null || task.assignee.id === ownScope)
      .filter((task) => matches(task, { limit, offset, ...query }))
      .toSorted((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"))
    return tasksPageSchema.parse(paginate(tasks, { limit, offset }))
  },
}

/** Задача из `GET /activities/?kind=task` (P0); имена полей уже в camelCase */
const backendTaskSchema = z.object({
  id: z.string(),
  subjectType: z.enum(["customer", "deal", "lead"]),
  subjectId: z.string(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  dueDate: z.iso.date().nullable(),
  taskStatus: z.enum(["open", "completed", "cancelled"]),
  taskType: z.enum(["call", "meeting", "follow_up", "other"]).nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).nullable(),
  assigneeUserId: z.string().nullable(),
  createdBy: z.string().nullable(),
  result: z.string().nullable(),
  isOverdue: z.boolean(),
  dueGroup: z.enum(["overdue", "today", "this_week", "later"]).nullable(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
})

const backendTasksPageSchema = paginatedSchema(backendTaskSchema)
type BackendTask = z.infer<typeof backendTaskSchema>

/** «Напомнить» и «другое» у backend — обычная задача в интерфейсе */
const TASK_TYPES: Record<NonNullable<z.infer<typeof backendTaskSchema>["taskType"]>, TaskType> = {
  call: "call",
  meeting: "meeting",
  follow_up: "todo",
  other: "todo",
}

const BACKEND_STATUS = { open: "open", done: "completed", all: undefined } as const

/** Имя по id пользователя: без права на список сотрудников известно только своё */
export async function loadTaskPeopleNames(): Promise<(userId: string) => string> {
  const [memberNames, user] = await Promise.all([loadMemberNames(), getCurrentUser()])
  return (userId) => (userId === user.id ? user.fullName : memberNames.get(userId) ?? "Сотрудник")
}

export function toTask(task: BackendTask, nameOf: (userId: string) => string): Task {
  return {
    id: task.id,
    title: task.title || "Без названия",
    description: task.body,
    type: task.taskType ? TASK_TYPES[task.taskType] : "todo",
    priority: task.priority === "high" || task.priority === "urgent" ? "high" : "normal",
    status: task.taskStatus === "completed" ? "done" : "open",
    dueAt: task.dueDate,
    isOverdue: task.isOverdue,
    dueGroup: task.taskStatus === "open" ? (task.dueGroup ?? "no_due") : null,
    assignee: task.assigneeUserId ? { id: task.assigneeUserId, name: nameOf(task.assigneeUserId) } : null,
    createdBy: task.createdBy ? { id: task.createdBy, name: nameOf(task.createdBy) } : { id: "", name: "Неизвестно" },
    lead: null,
    completedAt: task.completedAt,
    result: task.result,
  }
}

/** Типы задач, которые принимает backend; «Сообщение» он не поддерживает */
export const SERVER_TASK_TYPES = ["call", "meeting", "todo"] as const satisfies readonly TaskType[]
const BACKEND_TASK_TYPE: Record<(typeof SERVER_TASK_TYPES)[number], string> = { call: "call", meeting: "meeting", todo: "other" }

export type NewDealTask = {
  title: string
  /** YYYY-MM-DD: backend хранит срок как дату */
  dueDate: string
  type: (typeof SERVER_TASK_TYPES)[number]
  priority: Task["priority"]
  /** null — себе (так backend поступает и без поля) */
  assigneeId: string | null
  description: string | null
}

/** `POST /activities/` — задача, привязанная к сделке. Права, лимит открытых задач и исполнителя проверяет backend */
export async function createDealTask(auth: ApiAuth, dealId: string, task: NewDealTask): Promise<BackendTask> {
  return apiRequest("/api/v1/activities/", {
    method: "POST",
    auth,
    body: {
      kind: "task",
      subjectType: "deal",
      subjectId: dealId,
      title: task.title,
      dueDate: task.dueDate,
      taskType: BACKEND_TASK_TYPE[task.type],
      priority: task.priority,
      ...(task.assigneeId ? { assigneeUserId: task.assigneeId } : {}),
      ...(task.description ? { body: task.description } : {}),
    },
    schema: backendTaskSchema,
  })
}

/** `POST /activities/{id}/complete/` — выполнить открытую задачу (409, если она уже закрыта) */
export async function completeTask(auth: ApiAuth, taskId: string, result: string | null): Promise<BackendTask> {
  return apiRequest(`/api/v1/activities/${encodeURIComponent(taskId)}/complete/`, {
    method: "POST",
    auth,
    body: result ? { result } : {},
    schema: backendTaskSchema,
  })
}

/**
 * Пока подключены только задачи сделки (карточка лида): фильтров по исполнителю и поиска
 * у backend нет, а молча показать неотфильтрованный список было бы неправдой.
 * Отменённые задачи не показываются: в интерфейсе нет такого статуса.
 */
const httpTasksRepository: TasksRepository = {
  async getTodayTasks() {
    return contractPending("задачи пользователя на сегодня")
  },
  async listTasks({ status, assigneeId, leadId, search, limit, offset }) {
    if (!leadId || assigneeId || search) return contractPending("список задач с фильтрами")
    const [page, nameOf] = await Promise.all([
      apiRequest("/api/v1/activities/", {
        auth: await getRenderAuth(),
        query: { kind: "task", subjectType: "deal", subjectId: leadId, taskStatus: BACKEND_STATUS[status], limit, offset },
        schema: backendTasksPageSchema,
      }),
      loadTaskPeopleNames(),
    ])
    const visible = page.results.filter((task) => task.taskStatus !== "cancelled")
    const tasks = visible.map((task) => toTask(task, nameOf))
    return { count: page.count - (page.results.length - visible.length), results: tasks }
  },
}

export const tasksRepository: TasksRepository = isMockDataSource
  ? mockTasksRepository
  : httpTasksRepository
