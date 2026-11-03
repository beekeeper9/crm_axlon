import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { taskSchema, todayTasksSchema, type Task, type TaskType, type TodayTasks } from "@/features/tasks/schemas"
import { loadPeopleNames } from "@/features/team"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { contractPending } from "@/lib/api/errors"
import { paginate, paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { companyDateOf } from "@/lib/datetime"
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
  /** Срок: просроченные, на сегодня, без срока (считает backend по дню компании) */
  due?: "overdue" | "today" | "no_due" | null
  /** Только важные (high и urgent на backend) */
  important?: boolean
}

export type TasksRepository = {
  /** Задачи текущего пользователя на сегодня */
  getTodayTasks(): Promise<TodayTasks>
  listTasks(query: TasksQuery): Promise<Paginated<Task>>
}

const tasksPageSchema = paginatedSchema(taskSchema)

function matches(task: Task, { status, assigneeId, leadId, search, due = null, important = false }: TasksQuery): boolean {
  if (status !== "all" && task.status !== status) return false
  if (important && task.priority !== "high") return false
  if (due === "overdue" && !task.isOverdue) return false
  if (due === "today" && task.dueGroup !== "today") return false
  if (due === "no_due" && task.dueAt !== null) return false
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
  taskType: z.enum(["call", "meeting", "follow_up", "other", "review"]).nullable(),
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
  // Задача «Работы над ошибками» — обычная задача в списке, пакеты — в разделе «Работа над ошибками»
  review: "todo",
  other: "todo",
}

const BACKEND_STATUS = { open: "open", done: "completed", all: undefined } as const

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

/** К чему привязана задача: сделка или клиент (backend не принимает задачу без привязки) */
export type TaskSubject = { type: "deal" | "customer"; id: string }

/**
 * `POST /activities/` — задача по сделке или клиенту. Права, исполнителя и лимит открытых задач
 * на сделку (не больше двух) проверяет backend.
 */
export async function createTask(auth: ApiAuth, subject: TaskSubject, task: NewDealTask): Promise<BackendTask> {
  return apiRequest("/api/v1/activities/", {
    method: "POST",
    auth,
    body: taskCreateBody(subject, task),
    schema: backendTaskSchema,
  })
}

/** Тело `POST /activities/`: поля приходят в camelCase и уходят в snake_case */
export function taskCreateBody(subject: TaskSubject, task: NewDealTask): Record<string, string> {
  return {
    kind: "task",
    subjectType: subject.type,
    subjectId: subject.id,
    title: task.title,
    dueDate: task.dueDate,
    taskType: BACKEND_TASK_TYPE[task.type],
    priority: task.priority,
    ...(task.assigneeId ? { assigneeUserId: task.assigneeId } : {}),
    ...(task.description ? { body: task.description } : {}),
  }
}

/** Задача по сделке (карточка сделки) */
export async function createDealTask(auth: ApiAuth, dealId: string, task: NewDealTask): Promise<BackendTask> {
  return createTask(auth, { type: "deal", id: dealId }, task)
}

const subjectSearchSchema = paginatedSchema(z.object({ id: z.string(), title: z.string().optional(), name: z.string().optional() }))

export type TaskSubjectOption = TaskSubject & { name: string }

/** Сделки (открытые) и клиенты (не в архиве), видимые пользователю, — для выбора привязки задачи */
export async function searchTaskSubjects(auth: ApiAuth, search: string): Promise<TaskSubjectOption[]> {
  const query = search.trim() || undefined
  const [deals, customers] = await Promise.all([
    apiRequest("/api/v1/sales/deals/", { auth, query: { search: query, status: "open", ordering: "-created_at", limit: 8 }, schema: subjectSearchSchema }),
    apiRequest("/api/v1/customers/", { auth, query: { search: query, archived: "false", ordering: "-created_at", limit: 8 }, schema: subjectSearchSchema }),
  ])
  return [
    ...deals.results.map((deal) => ({ type: "deal" as const, id: deal.id, name: deal.title ?? "Сделка" })),
    ...customers.results.map((customer) => ({ type: "customer" as const, id: customer.id, name: customer.name ?? "Клиент" })),
  ]
}

export type TaskChanges = {
  title: string
  dueDate: string
  priority: Task["priority"]
  description: string | null
}

/** `PATCH /activities/{id}/` — название, срок, приоритет и описание; тип задачи backend не меняет */
export async function updateTask(auth: ApiAuth, taskId: string, changes: TaskChanges): Promise<BackendTask> {
  return apiRequest(`/api/v1/activities/${encodeURIComponent(taskId)}/`, {
    method: "PATCH",
    auth,
    body: { title: changes.title, dueDate: changes.dueDate, priority: changes.priority, body: changes.description ?? "" },
    schema: backendTaskSchema,
  })
}

/** `POST /activities/{id}/reassign/` — передать задачу; кому можно, решает backend */
export async function reassignTask(auth: ApiAuth, taskId: string, assigneeId: string): Promise<BackendTask> {
  return apiRequest(`/api/v1/activities/${encodeURIComponent(taskId)}/reassign/`, {
    method: "POST",
    auth,
    body: { assigneeUserId: assigneeId },
    schema: backendTaskSchema,
  })
}

/** `POST /activities/{id}/cancel/` и `/reopen/` — отменить открытую или вернуть закрытую задачу */
export async function changeTaskState(auth: ApiAuth, taskId: string, action: "cancel" | "reopen"): Promise<BackendTask> {
  return apiRequest(`/api/v1/activities/${encodeURIComponent(taskId)}/${action}/`, { method: "POST", auth, body: {}, schema: backendTaskSchema })
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

const dealTitleSchema = z.object({ id: z.string(), title: z.string() })
const customerNameSchema = z.object({ id: z.string(), name: z.string() })

/** Ссылка на клиента задачи — его карточка в «Базе клиентов» */
export function customerHref(customerId: string): string {
  return `${routes.clientBase}?client=${encodeURIComponent(customerId)}`
}

/**
 * Названия сделок и клиентов для ссылок из общего списка: уникальные id одной страницы.
 * Недоступные пользователю (404) остаются без ссылки, а не подписываются выдуманным именем.
 */
async function subjectRefs(auth: ApiAuth, tasks: readonly BackendTask[]): Promise<Map<string, Task["lead"]>> {
  const unique = (type: BackendTask["subjectType"]) => [...new Set(tasks.filter((task) => task.subjectType === type).map((task) => task.subjectId))]
  const [deals, customers] = await Promise.all([
    Promise.all(
      unique("deal").map((id) => apiRequest(`/api/v1/sales/deals/${encodeURIComponent(id)}/`, { auth, schema: dealTitleSchema }).catch(() => null))
    ),
    Promise.all(
      unique("customer").map((id) => apiRequest(`/api/v1/customers/${encodeURIComponent(id)}/`, { auth, schema: customerNameSchema }).catch(() => null))
    ),
  ])
  const refs = new Map<string, Task["lead"]>()
  for (const deal of deals) if (deal) refs.set(deal.id, { id: deal.id, name: deal.title, href: null })
  for (const customer of customers) if (customer) refs.set(customer.id, { id: customer.id, name: customer.name, href: customerHref(customer.id) })
  return refs
}

/**
 * `GET /activities/?kind=task`: видимость (свои, команда, все) решает backend.
 * Поиск — по названию и описанию задачи (`search`). Задачи всегда назначены (без исполнителя — себе),
 * поэтому «Без исполнителя» честно пусто. Отменённые задачи не показываются: в интерфейсе нет такого статуса.
 */
const httpTasksRepository: TasksRepository = {
  async getTodayTasks() {
    return contractPending("задачи пользователя на сегодня")
  },
  async listTasks({ status, assigneeId, leadId, search, due = null, important = false, limit, offset }) {
    const today = due === "today" ? companyDateOf(new Date().toISOString()) : undefined
    if (assigneeId === UNASSIGNED) return { count: 0, results: [] }
    const auth = await getRenderAuth()
    const [page, nameOf] = await Promise.all([
      apiRequest("/api/v1/activities/", {
        auth,
        query: {
          kind: "task",
          ...(leadId ? { subjectType: "deal", subjectId: leadId } : {}),
          assigneeId: assigneeId ?? undefined,
          taskStatus: BACKEND_STATUS[status],
          ...(due === "overdue" ? { overdue: "true" } : {}),
          ...(due === "no_due" ? { noDueDate: "true" } : {}),
          ...(today ? { dueFrom: today, dueTo: today } : {}),
          // Backend фильтрует по одному приоритету; «важные» в интерфейсе — это high
          ...(important ? { priority: "high" } : {}),
          search: search ?? undefined,
          limit,
          offset,
        },
        schema: backendTasksPageSchema,
      }),
      loadPeopleNames(),
    ])
    const visible = page.results.filter((task) => task.taskStatus !== "cancelled")
    const refs = leadId ? new Map<string, Task["lead"]>() : await subjectRefs(auth, visible)
    const tasks = visible.map((task) => ({ ...toTask(task, nameOf), lead: refs.get(task.subjectId) ?? null }))
    return { count: page.count - (page.results.length - visible.length), results: tasks }
  },
}

export const tasksRepository: TasksRepository = isMockDataSource
  ? mockTasksRepository
  : httpTasksRepository
