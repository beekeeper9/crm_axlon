import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const apiRequest = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}), getRenderAuth: async () => ({}) }))
vi.mock("@/config/env", () => ({ isMockDataSource: false }))

const { saveLeadRoutingAction } = await import("@/features/lead-routing/actions")

const input = { enabled: true, memberIds: ["u-1", "u-2"] }

describe("сохранение автораспределения лидов", () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it("уходит в backend для отдела", async () => {
    apiRequest.mockResolvedValue({})
    expect(await saveLeadRoutingAction("d-1", input)).toBeNull()
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/leads/routing/",
      expect.objectContaining({ method: "PUT", query: { departmentId: "d-1" }, body: input })
    )
  })

  it("дубль менеджера не отправляется", async () => {
    expect(await saveLeadRoutingAction("d-1", { ...input, memberIds: ["u-1", "u-1"] })).toMatch(/дважды/)
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("чужой отдел — понятный отказ, без ложного успеха", async () => {
    apiRequest.mockImplementation(async () => {
      throw new ApiError("forbidden", "own department only")
    })
    expect(await saveLeadRoutingAction("d-2", input)).toMatch(/своего отдела/)
  })

  it("менеджер не из отдела — сообщение об ошибке", async () => {
    apiRequest.mockImplementation(async () => {
      throw new ApiError("validation", "member_ids must be active sales managers of the department.")
    })
    expect(await saveLeadRoutingAction("d-1", input)).toMatch(/не является активным менеджером/)
  })
})
