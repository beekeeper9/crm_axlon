import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const createTask = vi.fn()
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}) }))
vi.mock("@/features/team", () => ({ loadPeopleNames: async () => () => "Айбек" }))
vi.mock("@/features/tasks/api/tasks-repository", async (original) => ({
  ...(await original<typeof import("@/features/tasks/api/tasks-repository")>()),
  createTask: (...args: unknown[]) => createTask(...args),
}))

const { createTaskAction } = await import("@/features/tasks/actions")

const input = { title: "Отправить КП", dueDate: "2026-11-05", type: "call" as const, priority: "normal" as const, assigneeId: "u-aibek", description: "" }
const created = {
  id: "t-1",
  subjectType: "deal",
  subjectId: "d-1",
  title: "Отправить КП",
  body: null,
  dueDate: "2026-11-05",
  taskStatus: "open",
  taskType: "call",
  priority: "normal",
  assigneeUserId: "u-aibek",
  createdBy: "u-rop",
  result: null,
  isOverdue: false,
  dueGroup: "this_week",
  completedAt: null,
}

describe("createTaskAction — новая задача со страницы «Задачи»", () => {
  beforeEach(() => {
    createTask.mockReset()
  })

  it("выбранная сделка без id не уходит на backend", async () => {
    const result = await createTaskAction({ type: "deal", id: "", name: "" }, input)
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("Выберите сделку или клиента") })
    expect(createTask).not.toHaveBeenCalled()
  })

  it("без сделки и клиента задача ставится исполнителю", async () => {
    createTask.mockResolvedValue({ ...created, subjectType: "member", subjectId: "u-aibek" })
    const result = await createTaskAction(null, input)
    expect(createTask).toHaveBeenCalledWith({}, null, expect.objectContaining({ assigneeId: "u-aibek" }))
    expect(result).toMatchObject({ ok: true, task: { id: "t-1", assignee: { id: "u-aibek" } } })
  })

  it("обязательные поля проверяются до запроса", async () => {
    const result = await createTaskAction({ type: "deal", id: "d-1", name: "Окна" }, { ...input, title: "КП" })
    expect(result.ok).toBe(false)
    expect(createTask).not.toHaveBeenCalled()
  })

  it("задача по сделке: исполнитель уходит на backend, ссылка на сделку — в ответе", async () => {
    createTask.mockResolvedValue(created)
    const result = await createTaskAction({ type: "deal", id: "d-1", name: "Окна" }, input)
    expect(createTask).toHaveBeenCalledWith({}, { type: "deal", id: "d-1", name: "Окна" }, expect.objectContaining({ assigneeId: "u-aibek", description: null }))
    expect(result).toMatchObject({ ok: true, task: { id: "t-1", lead: { id: "d-1", name: "Окна" }, assignee: { id: "u-aibek" } } })
  })

  it("лимит двух открытых задач на сделку и запрет исполнителя — понятные сообщения", async () => {
    createTask.mockRejectedValueOnce(new ApiError("conflict", "At most two open tasks"))
    const limit = await createTaskAction({ type: "deal", id: "d-1", name: "Окна" }, input)
    expect(limit).toMatchObject({ ok: false, message: expect.stringContaining("две открытые задачи") })
    createTask.mockRejectedValueOnce(new ApiError("forbidden", "Assignee outside scope"))
    const denied = await createTaskAction({ type: "customer", id: "c-1", name: "ОсОО Свет" }, input)
    expect(denied).toMatchObject({ ok: false, message: expect.stringContaining("нет права") })
  })
})
