import { beforeEach, describe, expect, it, vi } from "vitest"

const apiRequest = vi.fn()
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getRenderAuth: async () => ({ tenant: "demo" }) }))
vi.mock("@/features/team", () => ({ loadPeopleNames: async () => () => "Айгуль" }))

const { tasksRepository, UNASSIGNED } = await import("@/features/tasks/api/tasks-repository")

const task = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  subjectType: "deal",
  subjectId: "d-1",
  title: "Перезвонить",
  body: null,
  dueDate: "2026-11-02",
  taskStatus: "open",
  taskType: "call",
  priority: "normal",
  assigneeUserId: "u-1",
  createdBy: "u-1",
  result: null,
  isOverdue: false,
  dueGroup: "today",
  completedAt: null,
  ...overrides,
})

const query = { status: "open" as const, assigneeId: null, leadId: null, search: null, limit: 20, offset: 0 }

describe("httpTasksRepository.listTasks", () => {
  beforeEach(() => apiRequest.mockReset())

  it("«Без исполнителя» — честно пусто: backend всегда назначает задачу", async () => {
    await expect(tasksRepository.listTasks({ ...query, assigneeId: UNASSIGNED })).resolves.toEqual({ count: 0, results: [] })
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("поиск уходит в backend", async () => {
    apiRequest.mockResolvedValueOnce({ count: 0, results: [] })
    await tasksRepository.listTasks({ ...query, search: "звонок" })
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/activities/", expect.objectContaining({ query: expect.objectContaining({ search: "звонок" }) }))
  })

  it("общий список: фильтр по исполнителю, название сделки, отменённые скрыты", async () => {
    apiRequest.mockImplementation(async (path: string) =>
      path === "/api/v1/activities/"
        ? { count: 2, results: [task("t-1"), task("t-2", { taskStatus: "cancelled" })] }
        : { id: "d-1", title: "Окна ПВХ" }
    )
    const page = await tasksRepository.listTasks({ ...query, assigneeId: "u-1" })
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/activities/",
      expect.objectContaining({ query: expect.objectContaining({ kind: "task", assigneeId: "u-1", taskStatus: "open" }) })
    )
    expect(page.count).toBe(1)
    expect(page.results.map((item) => item.lead)).toEqual([{ id: "d-1", name: "Окна ПВХ" }])
  })
})

describe("фильтры задач уходят в backend", () => {
  it("просроченные и важные", async () => {
    apiRequest.mockReset()
    apiRequest.mockResolvedValue({ count: 0, results: [] })
    await tasksRepository.listTasks({ ...query, due: "overdue", important: true })
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/activities/",
      expect.objectContaining({ query: expect.objectContaining({ overdue: "true", priority: "high" }) })
    )
  })

  it("без срока", async () => {
    apiRequest.mockReset()
    apiRequest.mockResolvedValue({ count: 0, results: [] })
    await tasksRepository.listTasks({ ...query, due: "no_due" })
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/activities/", expect.objectContaining({ query: expect.objectContaining({ noDueDate: "true" }) }))
  })
})
