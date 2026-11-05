import { beforeEach, describe, expect, it, vi } from "vitest"

const apiRequest = vi.fn()
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getRenderAuth: async () => ({ tenant: "demo" }) }))
vi.mock("@/features/team", () => ({ loadPeopleNames: async () => (id: string) => (id === "u-1" ? "Айгуль" : "Сотрудник") }))

const { conversionBody, prospectsRepository, toProspect } = await import("@/features/prospects/api/prospects-repository")
const { ApiError } = await import("@/lib/api/errors")

const lead = {
  id: "l-1",
  name: "Айжан",
  email: null,
  phone: "+996555100200",
  source: "instagram" as const,
  status: "qualified" as const,
  ownerUserId: "u-1",
  disqualifyReason: null,
  convertedCustomerId: null,
  version: 2,
  createdAt: "2026-11-02T09:15:00+06:00",
}

describe("toProspect", () => {
  it("ответственный — с именем из справочника, статус и версия — как у backend", () => {
    const prospect = toProspect(lead, (id) => (id === "u-1" ? "Айгуль" : "Сотрудник"))
    expect(prospect.owner).toEqual({ id: "u-1", name: "Айгуль" })
    expect(prospect.status).toBe("qualified")
    expect(prospect.version).toBe(2)
    expect(prospect).not.toHaveProperty("ownerUserId")
  })
})

describe("httpProspectsRepository", () => {
  beforeEach(() => apiRequest.mockReset())

  it("фильтры списка уходят в backend; пустые — не отправляются", async () => {
    apiRequest.mockResolvedValueOnce({ count: 1, results: [lead] })
    const page = await prospectsRepository.listProspects({ search: "айжан", status: "new", source: null, ownerId: "u-1", limit: 25, offset: 25 })
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/leads/",
      expect.objectContaining({
        query: { search: "айжан", status: "new", source: undefined, ownerId: "u-1", ordering: "-created_at", limit: 25, offset: 25 },
      })
    )
    expect(page.results[0]?.owner.name).toBe("Айгуль")
  })

  it("чужой или несуществующий лид — null (404), остальные ошибки не глотаются", async () => {
    apiRequest.mockRejectedValueOnce(new ApiError("not_found", "Lead not found."))
    await expect(prospectsRepository.getProspect("l-x")).resolves.toBeNull()
    apiRequest.mockRejectedValueOnce(new ApiError("server", "boom"))
    await expect(prospectsRepository.getProspect("l-x")).rejects.toMatchObject({ kind: "server" })
  })
})

describe("conversionBody", () => {
  it("подтверждённый дубль — привязка к существующему клиенту без новой карточки", () => {
    expect(conversionBody({ customerId: "c-1", deal: null })).toEqual({ customerId: "c-1" })
  })

  it("новый клиент со сделкой — create_deal с этапом и следующим шагом, без customer_id", () => {
    const nextStep = { title: "Перезвонить", dueDate: "2026-11-10" }
    expect(conversionBody({ customerId: null, deal: { title: "Окна", amount: "15000", pipelineId: null, stageId: "s-2", nextStep } })).toEqual({
      createDeal: { title: "Окна", amount: "15000", stageId: "s-2", nextStep },
    })
  })
})
