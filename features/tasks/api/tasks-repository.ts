import { isMockDataSource } from "@/config/env"
import { todayTasksSchema, type TodayTasks } from "@/features/tasks/schemas"
import { contractPending } from "@/lib/api/errors"
import { simulateLatency } from "@/mocks/latency"
import { demoTodayTasks } from "@/mocks/tasks"

export type TasksRepository = {
  /** Задачи текущего пользователя на сегодня */
  getTodayTasks(): Promise<TodayTasks>
}

const mockTasksRepository: TasksRepository = {
  async getTodayTasks() {
    await simulateLatency(550)
    return todayTasksSchema.parse(demoTodayTasks)
  },
}

/** Endpoint не согласован — см. docs/API_CONTRACT.md, раздел «Задачи». */
const httpTasksRepository: TasksRepository = {
  async getTodayTasks() {
    return contractPending("задачи пользователя на сегодня")
  },
}

export const tasksRepository: TasksRepository = isMockDataSource
  ? mockTasksRepository
  : httpTasksRepository
