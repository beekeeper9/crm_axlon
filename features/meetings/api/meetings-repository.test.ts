import { beforeEach, describe, expect, it, vi } from "vitest"

const apiRequest = vi.fn()
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getRenderAuth: async () => ({ tenant: "demo" }) }))
vi.mock("@/features/team", () => ({ loadPeopleNames: async () => (id: string) => (id === "u-host" ? "Айгуль" : "Сотрудник") }))

const { meetingsRepository, toMeeting } = await import("@/features/meetings/api/meetings-repository")

const base = {
  id: "m-1",
  title: "Встреча: Окна",
  status: "scheduled" as const,
  description: null,
  location: null,
  subjectType: "deal" as const,
  subjectId: "d-1",
  scheduledStart: "2026-11-02T10:00:00+06:00",
  scheduledEnd: "2026-11-02T11:00:00+06:00",
  ownerUserId: "u-host",
  format: "office" as const,
  hostUserId: "u-host",
  bookedByUserId: null,
  confirmedAt: null,
  outcome: null,
}
const names = (id: string) => (id === "u-host" ? "Айгуль" : "Сотрудник")
const BEFORE_END = Date.parse("2026-11-02T10:30:00+06:00")
const AFTER_END = Date.parse("2026-11-02T11:30:00+06:00")

describe("toMeeting", () => {
  it("подтверждённая запланированная встреча — статус «подтверждена»", () => {
    const meeting = toMeeting({ ...base, confirmedAt: "2026-11-01T12:00:00+06:00" }, names, new Map(), BEFORE_END)
    expect(meeting.status).toBe("confirmed")
    expect(meeting.clientConfirmation).toBe("confirmed")
  })

  it("итог нужен только у запланированной встречи, время которой прошло", () => {
    expect(toMeeting(base, names, new Map(), BEFORE_END).outcomeRequired).toBe(false)
    expect(toMeeting(base, names, new Map(), AFTER_END).outcomeRequired).toBe(true)
    expect(toMeeting({ ...base, status: "held" }, names, new Map(), AFTER_END).outcomeRequired).toBe(false)
  })

  it("ссылка ведёт на сделку с её названием; встреча с клиентом без сделки — без ссылки", () => {
    expect(toMeeting(base, names, new Map([["d-1", "Окна ПВХ"]]), BEFORE_END).lead).toEqual({ id: "d-1", name: "Окна ПВХ" })
    const withCustomer = toMeeting({ ...base, subjectType: "customer", subjectId: "c-1" }, names, new Map([["c-1", "ОсОО Свет"]]), BEFORE_END)
    expect(withCustomer.lead).toEqual({ id: "", name: "ОсОО Свет" })
  })
})

describe("httpMeetingsRepository.listMeetings", () => {
  beforeEach(() => apiRequest.mockReset())

  it("поиск, которого нет у backend, не подменяется неотфильтрованным списком", async () => {
    await expect(
      meetingsRepository.listMeetings({ period: null, status: null, hostId: null, leadId: null, search: "окна", outcomeRequired: false, limit: 20, offset: 0 })
    ).rejects.toMatchObject({ kind: "contract_pending" })
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("фильтры уходят в backend: ведущий → owner_id, лид → сделка", async () => {
    apiRequest.mockResolvedValueOnce({ count: 0, results: [] })
    await meetingsRepository.listMeetings({ period: null, status: "held", hostId: "u-host", leadId: "d-1", search: null, outcomeRequired: false, limit: 20, offset: 0 })
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/meetings/",
      expect.objectContaining({ query: expect.objectContaining({ status: "held", ownerId: "u-host", subjectType: "deal", subjectId: "d-1" }) })
    )
  })
})

describe("«Без итога» без произвольного лимита", () => {
  it("загружает все страницы и считает по всем встречам", async () => {
    apiRequest.mockReset()
    const page = (offset: number, n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...base, id: `m-${offset + i}`, subjectId: null, subjectType: null, scheduledEnd: "2026-01-01T10:00:00+06:00" }))
    apiRequest.mockImplementation(async (_path: string, { query }: { query: { offset: number } }) =>
      query.offset === 0 ? { count: 250, results: page(0, 200) } : { count: 250, results: page(200, 50) }
    )
    const result = await meetingsRepository.listMeetings({ period: null, status: null, hostId: null, leadId: null, search: null, outcomeRequired: true, limit: 20, offset: 0 })
    expect(apiRequest).toHaveBeenCalledTimes(2)
    expect(result.count).toBe(250)
    expect(result.results).toHaveLength(20)
  })
})
