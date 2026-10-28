import { isMockDataSource } from "@/config/env"
import { taskSchema, todayTasksSchema, type Task, type TodayTasks } from "@/features/tasks/schemas"
import { contractPending } from "@/lib/api/errors"
import { paginate, paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"
import { getCurrentUser } from "@/lib/session/current-user"
import { simulateLatency } from "@/mocks/latency"
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

  async listTasks({ limit, offset, ...query }) {
    await simulateLatency(400)
    const tasks = demoTasks
      .filter((task) => matches(task, { limit, offset, ...query }))
      .toSorted((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"))
    return tasksPageSchema.parse(paginate(tasks, { limit, offset }))
  },
}

/** Endpoint не согласованы — см. docs/API_CONTRACT.md, раздел «Задачи». */
const httpTasksRepository: TasksRepository = {
  async getTodayTasks() {
    return contractPending("задачи пользователя на сегодня")
  },
  async listTasks() {
    return contractPending("список задач")
  },
}

export const tasksRepository: TasksRepository = isMockDataSource
  ? mockTasksRepository
  : httpTasksRepository
