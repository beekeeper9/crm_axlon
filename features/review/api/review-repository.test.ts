import { describe, expect, it, vi } from "vitest"

const apiRequest = vi.fn()
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getRenderAuth: async () => ({}) }))
vi.mock("@/features/team", () => ({ loadPeopleNames: async () => (id: string) => ({ "u-1": "Айбек", "u-rop": "Алина" })[id] ?? "Сотрудник" }))

const { fetchReviewGroups } = await import("@/features/review/api/review-repository")

const task = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  subjectType: "deal",
  subjectId: "d-1",
  title: "Перезвонить ЛПР",
  body: null,
  dueDate: "2026-11-05",
  taskStatus: "open",
  assigneeUserId: "u-1",
  createdBy: "u-rop",
  result: null,
  isOverdue: false,
  completedAt: null,
  ...overrides,
})

describe("пакеты «Работы над ошибками»", () => {
  it("запрашивает только задачи разбора и группирует по исполнителю со статусами", async () => {
    apiRequest.mockImplementation(async (path: string) =>
      path === "/api/v1/activities/"
        ? {
            count: 4,
            results: [
              task("t-1"),
              task("t-2", { isOverdue: true }),
              task("t-3", { taskStatus: "completed", completedAt: "2026-11-03T10:00:00+06:00" }),
              task("t-4", { taskStatus: "cancelled" }),
            ],
          }
        : { id: "d-1", title: "Окна ПВХ" }
    )
    const groups = await fetchReviewGroups()
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/activities/", expect.objectContaining({ query: expect.objectContaining({ kind: "task", taskType: "review" }) }))
    expect(groups).toHaveLength(1)
    const [group] = groups
    expect(group.assignee).toEqual({ id: "u-1", name: "Айбек" })
    expect([group.issued, group.done, group.overdue]).toEqual([3, 1, 1])
    expect(group.items.map((item) => item.status)).toEqual(["open", "overdue", "done"])
    expect(group.items[0].deal).toEqual({ id: "d-1", title: "Окна ПВХ" })
    expect(group.items[0].issuedBy).toBe("Алина")
  })
})
