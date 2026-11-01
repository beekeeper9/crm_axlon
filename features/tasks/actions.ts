"use server"

import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import {
  SERVER_TASK_TYPES,
  completeTask,
  createDealTask,
  loadTaskPeopleNames,
  toTask,
} from "@/features/tasks/api/tasks-repository"
import { taskPrioritySchema, type Task } from "@/features/tasks/schemas"
import { API_ERROR_MESSAGES, ApiError } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

export type TaskActionResult =
  | { ok: true; task: Task }
  | { ok: false; message: string; requestId: string | null }

const newDealTaskSchema = z.object({
  title: z.string().trim().min(3, "Опишите задачу — хотя бы 3 символа").max(200, "Не длиннее 200 символов"),
  dueDate: z.iso.date("Укажите срок"),
  type: z.enum(SERVER_TASK_TYPES),
  priority: taskPrioritySchema,
  assigneeId: z.string().min(1).nullable(),
  description: z.string().trim().max(2000, "Не длиннее 2000 символов"),
})

export type NewDealTaskInput = z.input<typeof newDealTaskSchema>

type Operation = "create" | "complete"

/** Что именно отказал сервер — по виду ошибки и операции; без технических подробностей */
function failure(error: unknown, operation: Operation): TaskActionResult {
  if (!(error instanceof ApiError)) throw error
  const requestId = error.requestId ?? null
  const messages: Partial<Record<ApiError["kind"], string>> = {
    // Единственный 409 при создании — лимит открытых задач на сделку
    conflict:
      operation === "create"
        ? "У сделки уже две открытые задачи — больше ставить нельзя. Выполните одну из них, чтобы поставить новую."
        : "Задача уже выполнена или отменена. Обновите страницу, чтобы увидеть актуальный статус.",
    not_found:
      operation === "create"
        ? "Сделка недоступна: возможно, её передали другому сотруднику."
        : "Задача недоступна: возможно, её передали другому сотруднику.",
    forbidden:
      operation === "create" ? "У вашей роли нет права ставить задачу этому сотруднику." : "У вашей роли нет права менять эту задачу.",
    validation: "Сервер не принял задачу: проверьте название, срок и исполнителя.",
    unauthorized: "Сессия истекла. Обновите страницу и войдите снова.",
  }
  return { ok: false, message: messages[error.kind] ?? API_ERROR_MESSAGES[error.kind], requestId }
}

const DEMO_ONLY: TaskActionResult = {
  ok: false,
  message: "В демо-режиме задачи на сервер не отправляются.",
  requestId: null,
}

/** Новая задача по сделке. Права, лимит открытых задач и исполнителя окончательно проверяет backend */
export async function createDealTaskAction(dealId: string, input: NewDealTaskInput): Promise<TaskActionResult> {
  if (isMockDataSource) return DEMO_ONLY
  const parsed = newDealTaskSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? API_ERROR_MESSAGES.validation, requestId: null }
  try {
    const created = await createDealTask(await getActionAuth(), dealId, {
      ...parsed.data,
      description: parsed.data.description || null,
    })
    return { ok: true, task: toTask(created, await loadTaskPeopleNames()) }
  } catch (error) {
    return failure(error, "create")
  }
}

export async function completeTaskAction(taskId: string, result: string): Promise<TaskActionResult> {
  if (isMockDataSource) return DEMO_ONLY
  const trimmed = result.trim().slice(0, 2000)
  try {
    const completed = await completeTask(await getActionAuth(), taskId, trimmed || null)
    return { ok: true, task: toTask(completed, await loadTaskPeopleNames()) }
  } catch (error) {
    return failure(error, "complete")
  }
}
