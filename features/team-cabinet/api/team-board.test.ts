import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const apiRequest = vi.fn()
/** Как настоящий клиент: ответ проходит через схему запроса (значения по умолчанию, проверка полей) */
vi.mock("@/lib/api/client", () => ({
  apiRequest: async (path: string, options: { schema: { parse: (data: unknown) => unknown } }) =>
    options.schema.parse(await apiRequest(path, options)),
}))
vi.mock("@/lib/auth/token-store", () => ({ getRenderAuth: async () => ({}) }))
vi.mock("@/features/team", () => ({ loadPeopleNames: async () => (id: string) => (id === "u-1" ? "Айбек Садыков" : "Сотрудник") }))

const { fetchMemberCard, fetchTeamBoard, fetchTeamReport } = await import("@/features/team-cabinet/api/team-board")

const period = {
  meetingsBooked: 4,
  meetingsHeld: 3,
  meetingsNoShow: 1,
  meetingsConfirmed: 2,
  meetingsCancelled: 0,
  calls: 7,
  stageChanges: 2,
  paymentsCount: 1,
  received: "15000.00",
  prepayments: 1,
  sales: 1,
  tasksDone: 5,
  attendance: "0.750",
  meetingToSale: "0.333",
}

describe("кабинет отдела: ответы backend", () => {
  beforeEach(() => apiRequest.mockReset())

  it("старый ответ «Сегодня» без новых полей разбирается: оценки нет, а не ноль", async () => {
    apiRequest.mockResolvedValueOnce({
      asOf: "2026-11-03T10:00:00+06:00",
      managers: [
        {
          userId: "u-1",
          username: "aibek",
          calls: 0,
          meetingsTotal: 0,
          meetingsConfirmed: 0,
          meetingsHeld: 0,
          meetingsNoShow: 0,
          meetingsOverdueOutcome: 0,
          paymentsCount: 0,
          received: "0",
          openTasks: 0,
          overdueTasks: 0,
          onAbsence: false,
          status: "red",
          redReasons: ["no_activity"],
          yellowReasons: [],
        },
      ],
      totals: { managers: 1, calls: 0, meetingsTotal: 0, meetingsHeld: 0, paymentsCount: 0, received: "0", red: 1, yellow: 0, green: 0 },
    })
    const board = await fetchTeamBoard()
    expect(board.managers[0].score).toBeNull()
    expect(board.managers[0].name).toBe("Айбек Садыков")
  })

  it("отчёт: период уходит в запрос, строки получают имена", async () => {
    apiRequest.mockResolvedValueOnce({
      period: "week",
      dateFrom: "2026-11-02",
      dateTo: "2026-11-08",
      departmentId: null,
      rows: [
        {
          ...period,
          meetingsWithoutOutcome: 0,
          reschedulesWithoutDate: 0,
          dealsWithoutNextStep: 1,
          overdueTasks: 2,
          userId: "u-1",
          username: "aibek",
          departmentId: "dep-1",
          productRole: "manager",
          planSales: null,
          monthSales: 1,
        },
      ],
      totals: period,
    })
    const report = await fetchTeamReport("week", "2026-11-03", "dep-1")
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/team/reports/", expect.objectContaining({ query: { period: "week", date: "2026-11-03", departmentId: "dep-1" } }))
    expect(report.rows[0]).toMatchObject({ name: "Айбек Садыков", overdueTasks: 2, planSales: null })
  })

  it("карточка чужого или несуществующего сотрудника — null (404), а не ошибка страницы", async () => {
    apiRequest.mockRejectedValueOnce(new ApiError("not_found", "No such member"))
    await expect(fetchMemberCard("u-x", null, null)).resolves.toBeNull()
  })
})
