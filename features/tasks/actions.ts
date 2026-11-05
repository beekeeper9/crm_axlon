"use server"

import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import {
  changeTaskState,
  completeTask,
  createTask,
  customerHref,
  reassignTask,
  searchTaskSubjects,
  SERVER_TASK_TYPES,
  type TaskSubjectOption,
  toTask,
  updateTask,
} from "@/features/tasks/api/tasks-repository"
import { loadPeopleNames } from "@/features/team"
import { taskPrioritySchema, type Task } from "@/features/tasks/schemas"
import { API_ERROR_MESSAGES, ApiError, apiErrorMessage } from "@/lib/api/errors"
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
  isMiss: z.boolean().default(false),
})

export type NewDealTaskInput = z.input<typeof newDealTaskSchema>

type Operation = "create" | "complete" | "update"

/** Что именно отказал сервер — по виду ошибки и операции; без технических подробностей */
function failure(error: unknown, operation: Operation): TaskActionResult {
  if (!(error instanceof ApiError)) throw error
  const requestId = error.requestId ?? null
  const messages: Partial<Record<ApiError["kind"], string>> = {
    // Единственный 409 при создании — лимит открытых задач на сделку
    conflict:
      operation === "create"
        ? "У сделки уже две открытые задачи — больше ставить нельзя. Выполните одну из них, чтобы поставить новую."
        : operation === "update"
          ? "Задачу уже изменили или закрыли. Обновите страницу, чтобы увидеть актуальную версию."
          : "Задача уже выполнена или отменена. Обновите страницу, чтобы увидеть актуальный статус.",
    not_found:
      operation === "create"
        ? "Сделка или клиент недоступны: возможно, их передали другому сотруднику."
        : "Задача недоступна: возможно, её передали другому сотруднику.",
    forbidden:
      operation === "create" ? "У вашей роли нет права ставить задачу этому сотруднику." : "У вашей роли нет права менять эту задачу.",
    validation: "Сервер не принял задачу: проверьте название, срок и исполнителя.",
    unauthorized: "Сессия истекла. Обновите страницу и войдите снова.",
  }
  const byCode = error.code === "subscription_inactive" || error.code === "feature_not_in_plan"
  return { ok: false, message: byCode ? apiErrorMessage(error) : (messages[error.kind] ?? apiErrorMessage(error)), requestId }
}

const DEMO_ONLY: TaskActionResult = {
  ok: false,
  message: "В демо-режиме задачи на сервер не отправляются.",
  requestId: null,
}

const subjectSchema = z.object({
  type: z.enum(["deal", "customer"]),
  id: z.string().min(1, "Выберите сделку или клиента"),
  name: z.string(),
})

/**
 * Новая задача по сделке, клиенту или (subject = null) просто исполнителю. Права, лимит открытых
 * задач на сделку и исполнителя окончательно проверяет backend. Сделка становится ссылкой задачи.
 */
export async function createTaskAction(subject: TaskSubjectOption | null, input: NewDealTaskInput): Promise<TaskActionResult> {
  if (isMockDataSource) return DEMO_ONLY
  const target = subject === null ? null : subjectSchema.safeParse(subject)
  if (target && !target.success) return { ok: false, message: "Выберите сделку или клиента, к которым относится задача.", requestId: null }
  const parsed = newDealTaskSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? API_ERROR_MESSAGES.validation, requestId: null }
  try {
    const created = await createTask(await getActionAuth(), target?.data ?? null, {
      ...parsed.data,
      description: parsed.data.description || null,
    })
    const task = toTask(created, await loadPeopleNames())
    // В карточке сделки имя не передаётся: связь задачи подставит сам список
    if (!target?.data.name) return { ok: true, task }
    const href = target.data.type === "customer" ? customerHref(target.data.id) : null
    return { ok: true, task: { ...task, lead: { id: target.data.id, name: target.data.name, href } } }
  } catch (error) {
    return failure(error, "create")
  }
}

/** Новая задача по сделке (карточка сделки) */
export async function createDealTaskAction(dealId: string, input: NewDealTaskInput): Promise<TaskActionResult> {
  return createTaskAction({ type: "deal", id: dealId, name: "" }, input)
}

/** Поиск сделок и клиентов для привязки новой задачи; видимость решает backend */
export async function searchTaskSubjectsAction(search: string): Promise<{ ok: true; options: TaskSubjectOption[] } | { ok: false; message: string }> {
  if (isMockDataSource) return { ok: false, message: "В демо-режиме поиск по серверу недоступен." }
  try {
    return { ok: true, options: await searchTaskSubjects(await getActionAuth(), search.slice(0, 100)) }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    return { ok: false, message: apiErrorMessage(error) }
  }
}

export async function completeTaskAction(taskId: string, result: string): Promise<TaskActionResult> {
  if (isMockDataSource) return DEMO_ONLY
  const trimmed = result.trim().slice(0, 2000)
  try {
    const completed = await completeTask(await getActionAuth(), taskId, trimmed || null)
    return { ok: true, task: toTask(completed, await loadPeopleNames()) }
  } catch (error) {
    return failure(error, "complete")
  }
}

const taskChangesSchema = newDealTaskSchema.omit({ type: true })

/** Правка задачи и, если сменился исполнитель, передача. Права окончательно проверяет backend */
export async function updateTaskAction(
  taskId: string,
  input: z.input<typeof taskChangesSchema>,
  previousAssigneeId: string | null
): Promise<TaskActionResult> {
  if (isMockDataSource) return DEMO_ONLY
  const parsed = taskChangesSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? API_ERROR_MESSAGES.validation, requestId: null }
  try {
    const auth = await getActionAuth()
    let saved = await updateTask(auth, taskId, { ...parsed.data, description: parsed.data.description || null })
    if (parsed.data.assigneeId && parsed.data.assigneeId !== previousAssigneeId) {
      saved = await reassignTask(auth, taskId, parsed.data.assigneeId)
    }
    return { ok: true, task: toTask(saved, await loadPeopleNames()) }
  } catch (error) {
    return failure(error, "update")
  }
}

/** Отменить открытую задачу или вернуть выполненную в работу */
export async function changeTaskStateAction(taskId: string, action: "cancel" | "reopen"): Promise<TaskActionResult> {
  if (isMockDataSource) return DEMO_ONLY
  try {
    const task = await changeTaskState(await getActionAuth(), taskId, action)
    return { ok: true, task: toTask(task, await loadPeopleNames()) }
  } catch (error) {
    return failure(error, "update")
  }
}
