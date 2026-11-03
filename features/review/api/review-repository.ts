import { z } from "zod"

import { loadPeopleNames } from "@/features/team"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { PAGE_LIMIT_MAX, paginatedSchema } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"

/**
 * «Работа над ошибками» (ТЗ: «Разбор»): РОП выдаёт менеджеру пакет — по каждой выбранной
 * сделке задача типа `review`. Хранится как обычные задачи (`/activities/`, task_type=review),
 * поэтому видимость, исполнитель, срок и выполнение — по правилам задач backend.
 */

const reviewTaskSchema = z.object({
  id: z.string(),
  subjectType: z.enum(["customer", "deal", "lead"]),
  subjectId: z.string(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  dueDate: z.iso.date().nullable(),
  taskStatus: z.enum(["open", "completed", "cancelled"]),
  assigneeUserId: z.string().nullable(),
  createdBy: z.string().nullable(),
  result: z.string().nullable(),
  isOverdue: z.boolean(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
})

export type ReviewItem = {
  id: string
  title: string
  note: string | null
  status: "open" | "done" | "overdue"
  dueDate: string | null
  completedAt: string | null
  result: string | null
  deal: { id: string; title: string } | null
  issuedBy: string | null
}

export type ReviewGroup = {
  assignee: { id: string; name: string }
  issued: number
  done: number
  overdue: number
  items: ReviewItem[]
}

const dealTitleSchema = z.object({ id: z.string(), title: z.string() })

/** Пакеты разбора по сотрудникам (отменённые не показываются) */
export async function fetchReviewGroups(): Promise<ReviewGroup[]> {
  const auth = await getRenderAuth()
  const [page, nameOf] = await Promise.all([
    apiRequest("/api/v1/activities/", {
      auth,
      query: { kind: "task", taskType: "review", limit: PAGE_LIMIT_MAX },
      schema: paginatedSchema(reviewTaskSchema),
    }),
    loadPeopleNames(),
  ])
  const tasks = page.results.filter((task) => task.taskStatus !== "cancelled")
  const dealIds = [...new Set(tasks.filter((t) => t.subjectType === "deal").map((t) => t.subjectId))]
  const deals = new Map(
    (await Promise.all(dealIds.map((id) => apiRequest(`/api/v1/sales/deals/${encodeURIComponent(id)}/`, { auth, schema: dealTitleSchema }).catch(() => null))))
      .filter((deal) => deal !== null)
      .map((deal) => [deal.id, deal.title])
  )
  const groups = new Map<string, ReviewGroup>()
  for (const task of tasks) {
    const assigneeId = task.assigneeUserId ?? ""
    const group = groups.get(assigneeId) ?? { assignee: { id: assigneeId, name: nameOf(assigneeId) }, issued: 0, done: 0, overdue: 0, items: [] }
    const status = task.taskStatus === "completed" ? "done" : task.isOverdue ? "overdue" : "open"
    group.issued += 1
    if (status === "done") group.done += 1
    if (status === "overdue") group.overdue += 1
    group.items.push({
      id: task.id,
      title: task.title ?? "Без названия",
      note: task.body,
      status,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      result: task.result,
      deal: task.subjectType === "deal" ? { id: task.subjectId, title: deals.get(task.subjectId) ?? "Сделка" } : null,
      issuedBy: task.createdBy ? nameOf(task.createdBy) : null,
    })
    groups.set(assigneeId, group)
  }
  return [...groups.values()].toSorted((a, b) => b.issued - b.done - (a.issued - a.done))
}

export type DealOption = { id: string; title: string; ownerId: string }

/** Открытые сделки отдела для выбора в пакет (последние PAGE_LIMIT_MAX видимых РОПу) */
export async function fetchTeamDeals(): Promise<DealOption[]> {
  const page = await apiRequest("/api/v1/sales/deals/", {
    auth: await getRenderAuth(),
    query: { status: "open", ordering: "-created_at", limit: PAGE_LIMIT_MAX },
    schema: paginatedSchema(z.object({ id: z.string(), title: z.string(), ownerUserId: z.string() })),
  })
  return page.results.map((deal) => ({ id: deal.id, title: deal.title, ownerId: deal.ownerUserId }))
}

/** Одна задача пакета: `POST /activities/` с task_type=review на исполнителя-менеджера */
export async function createReviewTask(
  auth: ApiAuth,
  task: { dealId: string; assigneeId: string; title: string; note: string | null; dueDate: string }
): Promise<void> {
  await apiRequest("/api/v1/activities/", {
    method: "POST",
    auth,
    body: {
      kind: "task",
      subjectType: "deal",
      subjectId: task.dealId,
      title: task.title,
      taskType: "review",
      priority: "high",
      dueDate: task.dueDate,
      assigneeUserId: task.assigneeId,
      ...(task.note ? { body: task.note } : {}),
    },
    schema: z.object({ id: z.string() }),
  })
}
