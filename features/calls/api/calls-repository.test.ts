import { beforeEach, describe, expect, it, vi } from "vitest"

const apiRequest = vi.fn()
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getRenderAuth: async () => ({ tenant: "demo" }) }))
vi.mock("@/features/team", () => ({ loadPeopleNames: async () => () => "Айгуль" }))

const { callsRepository, toCall } = await import("@/features/calls/api/calls-repository")

const base = {
  id: "c-1",
  direction: "outbound" as const,
  fromNumber: "+996312000000",
  toNumber: "+996555123456",
  status: "completed" as const,
  startedAt: "2026-11-02T10:00:00+06:00",
  durationSeconds: 95,
  recordingUrl: null,
  subjectType: "deal" as const,
  subjectId: "d-1",
  ownerUserId: "u-1",
  notes: null,
  createdAt: "2026-11-02T10:02:00+06:00",
}
const names = () => "Айгуль"
const query = { direction: null, missedOnly: false, managerId: null, leadId: null, search: null, limit: 50, offset: 0 }

describe("toCall", () => {
  it("разбор, транскрипт и оценка не выдумываются: телефония их не отдаёт", () => {
    const call = toCall(base, names, new Map([["d-1", "Окна ПВХ"]]))
    expect(call.analysis).toBeNull()
    expect(call.transcript).toBeNull()
    expect(call.rating).toBeNull()
  })

  it("номер клиента — «куда» для исходящего и «откуда» для входящего; сделка — ссылкой", () => {
    expect(toCall(base, names, new Map([["d-1", "Окна ПВХ"]]))).toMatchObject({
      phone: "+996555123456",
      direction: "outgoing",
      status: "answered",
      lead: { id: "d-1", name: "Окна ПВХ" },
      client: null,
    })
    const inbound = toCall({ ...base, direction: "inbound", subjectType: "customer", subjectId: "c-9" }, names, new Map([["c-9", "ОсОО Свет"]]))
    expect(inbound).toMatchObject({ phone: "+996312000000", lead: null, client: { id: "c-9", name: "ОсОО Свет" } })
  })

  it("несостоявшийся звонок — пропущенный; запись — только если есть ссылка", () => {
    expect(toCall({ ...base, status: "failed" }, names, new Map()).status).toBe("missed")
    expect(toCall(base, names, new Map()).hasRecording).toBe(false)
    expect(toCall({ ...base, recordingUrl: "https://rec.example/1" }, names, new Map()).recordingUrl).toBe("https://rec.example/1")
  })
})

describe("httpCallsRepository.listCalls", () => {
  beforeEach(() => apiRequest.mockReset())

  it("«Пропущенные» — и без ответа, и несостоявшиеся; направление уходит в backend", async () => {
    apiRequest.mockResolvedValueOnce({ count: 0, results: [] })
    await callsRepository.listCalls({ ...query, missedOnly: true, direction: "incoming" })
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/telephony/calls/",
      expect.objectContaining({ query: expect.objectContaining({ statuses: "missed,failed", direction: "inbound" }) })
    )
  })

  it("сотрудник, сделка, дни и поиск фильтруются на backend", async () => {
    apiRequest.mockResolvedValueOnce({ count: 0, results: [] })
    await callsRepository.listCalls({ ...query, managerId: "u-2", leadId: "d-1", dateFrom: "2026-11-01", dateTo: "2026-11-02", search: "555" })
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/telephony/calls/",
      expect.objectContaining({
        query: expect.objectContaining({
          ownerId: "u-2",
          subjectType: "deal",
          subjectId: "d-1",
          dateFrom: "2026-11-01",
          dateTo: "2026-11-02",
          search: "555",
        }),
      })
    )
  })

  it("звонки клиента — по привязке к клиенту", async () => {
    apiRequest.mockResolvedValueOnce({ count: 0, results: [] })
    await callsRepository.listCalls({ ...query, clientId: "c-9" })
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/telephony/calls/",
      expect.objectContaining({ query: expect.objectContaining({ subjectType: "customer", subjectId: "c-9" }) })
    )
  })
})
