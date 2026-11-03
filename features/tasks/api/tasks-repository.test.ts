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
    expect(page.results.map((item) => item.lead)).toEqual([{ id: "d-1", name: "Окна ПВХ", href: null }])
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

describe("создание задачи по любой привязке", () => {
  it("тело запроса: клиент, исполнитель и описание; без исполнителя — себе", async () => {
    const { taskCreateBody } = await import("@/features/tasks/api/tasks-repository")
    const base = { title: "Позвонить", dueDate: "2026-11-05", type: "todo" as const, priority: "high" as const, assigneeId: "u-2", description: "Про договор" }
    expect(taskCreateBody({ type: "customer", id: "c-1" }, base)).toEqual({
      kind: "task",
      subjectType: "customer",
      subjectId: "c-1",
      title: "Позвонить",
      dueDate: "2026-11-05",
      taskType: "other",
      priority: "high",
      assigneeUserId: "u-2",
      body: "Про договор",
    })
    const own = taskCreateBody({ type: "deal", id: "d-1" }, { ...base, assigneeId: null, description: null })
    expect(own).not.toHaveProperty("assigneeUserId")
    expect(own).not.toHaveProperty("body")
  })

  it("поиск привязки: открытые сделки и клиенты не в архиве", async () => {
    const { searchTaskSubjects } = await import("@/features/tasks/api/tasks-repository")
    apiRequest.mockReset()
    apiRequest.mockImplementation(async (path: string) =>
      path === "/api/v1/sales/deals/" ? { count: 1, results: [{ id: "d-1", title: "Окна" }] } : { count: 1, results: [{ id: "c-1", name: "ОсОО Свет" }] }
    )
    const options = await searchTaskSubjects({ tokens: {} as never }, " окна ")
    expect(options).toEqual([
      { type: "deal", id: "d-1", name: "Окна" },
      { type: "customer", id: "c-1", name: "ОсОО Свет" },
    ])
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/sales/deals/", expect.objectContaining({ query: expect.objectContaining({ search: "окна", status: "open" }) }))
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/customers/", expect.objectContaining({ query: expect.objectContaining({ search: "окна", archived: "false" }) }))
  })
})

describe("связь задачи со сделкой или клиентом", () => {
  it("клиент — ссылка в «Базу клиентов», сделка — карточка сделки, недоступное — без ссылки", async () => {
    apiRequest.mockReset()
    apiRequest.mockImplementation(async (path: string) => {
      if (path === "/api/v1/activities/") {
        return {
          count: 3,
          results: [
            task("t-1"),
            task("t-2", { subjectType: "customer", subjectId: "c-1" }),
            task("t-3", { subjectType: "customer", subjectId: "c-hidden" }),
          ],
        }
      }
      if (path.startsWith("/api/v1/sales/deals/")) return { id: "d-1", title: "Окна ПВХ" }
      if (path === "/api/v1/customers/c-1/") return { id: "c-1", name: "ОсОО Свет" }
      throw new Error("404")
    })
    const page = await tasksRepository.listTasks(query)
    expect(page.results.map((item) => item.lead)).toEqual([
      { id: "d-1", name: "Окна ПВХ", href: null },
      { id: "c-1", name: "ОсОО Свет", href: "/client-base?client=c-1" },
      null,
    ])
  })
})
