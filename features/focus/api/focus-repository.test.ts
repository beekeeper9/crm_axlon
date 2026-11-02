import { describe, expect, it, vi } from "vitest"

const apiRequest = vi.fn()
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getRenderAuth: async () => ({}) }))
vi.mock("@/features/team", () => ({ loadPeopleNames: async () => (id: string) => (id === "u-1" ? "Айгуль" : "Сотрудник") }))
vi.mock("@/features/sales", () => ({
  fetchPipeline: async () => ({ id: "p-1", name: "Продажи", stages: [{ id: "s-1", name: "Встреча", kind: "open" }] }),
}))

const { focusRepository } = await import("@/features/focus/api/focus-repository")

apiRequest.mockImplementation(async (path: string) => {
  if (path === "/api/v1/operations/findings/") {
    return {
      thresholds: { staleLeadDays: 2, stalledDealDays: 7 },
      truncated: false,
      findings: [
        { kind: "stalled_deal", recordType: "deal", recordId: "d-1", ownerUserId: "u-1", ageDays: 9, dealId: "d-1" },
        { kind: "stale_lead", recordType: "lead", recordId: "l-1", ownerUserId: "u-2", ageDays: 3, dealId: null },
        { kind: "overdue_task", recordType: "task", recordId: "t-1", ownerUserId: "u-1", ageDays: 1, dealId: "d-1" },
      ],
    }
  }
  if (path.startsWith("/api/v1/sales/deals/")) return { id: "d-1", title: "Окна", pipelineId: "p-1", stageId: "s-1", amount: "1000.00", currency: "KGS", nextStep: null }
  if (path.startsWith("/api/v1/leads/")) return { id: "l-1", name: "Заявка с сайта" }
  return { id: "t-1", title: "Перезвонить" }
})

describe("«Фокус» из /operations/findings/", () => {
  it("группы по правилам backend; приоритет и «ждут ответа» не придумываются", async () => {
    const focus = await focusRepository.getFocusList({ managerId: null })
    expect(focus.awaitingReply).toBeNull()
    expect(focus.groups.map((group) => [group.id, group.items.length])).toEqual([
      ["overdue_task", 1],
      ["stale_lead", 1],
      ["deal_without_next_step", 0],
      ["stalled_deal", 1],
    ])
    expect(focus.groups.flatMap((group) => group.items).every((item) => item.priority === null && item.aiRecommendation === null)).toBe(true)
  })

  it("лид ведёт в «Входящие лиды», задача — в карточку своей сделки", async () => {
    const focus = await focusRepository.getFocusList({ managerId: null })
    const lead = focus.groups.find((group) => group.id === "stale_lead")?.items[0]
    const task = focus.groups.find((group) => group.id === "overdue_task")?.items[0]
    expect(lead?.href).toBe("/prospects/l-1")
    expect(task?.lead).toEqual({ id: "d-1", name: "Окна" })
    expect(task?.reason.label).toContain("Перезвонить")
  })

  it("фильтр по сотруднику не меняет счётчики коллег", async () => {
    const focus = await focusRepository.getFocusList({ managerId: "u-1" })
    expect(focus.groups.flatMap((group) => group.items)).toHaveLength(2)
    expect(focus.managers).toEqual(expect.arrayContaining([{ id: "u-1", name: "Айгуль", count: 2 }, { id: "u-2", name: "Сотрудник", count: 1 }]))
  })
})
