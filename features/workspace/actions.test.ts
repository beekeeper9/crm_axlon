import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const apiRequest = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}), getRenderAuth: async () => ({}) }))

const { saveLayoutAction } = await import("@/features/workspace/actions")

const blocks = [
  { id: "plans" as const, visible: false },
  { id: "work_session" as const, visible: true },
]

describe("сохранение раскладки «Моего дня»", () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it("уходит в backend для отдела с порядком и видимостью", async () => {
    apiRequest.mockResolvedValue({ departmentId: "d-1", blocks, isDefault: false, updatedAt: "2026-11-03T10:00:00+06:00" })
    expect(await saveLayoutAction("d-1", blocks)).toBeNull()
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/workspace/layout/",
      expect.objectContaining({ method: "PUT", query: { departmentId: "d-1" }, body: { blocks } })
    )
  })

  it("дубль блока не отправляется", async () => {
    expect(await saveLayoutAction(null, [...blocks, blocks[0]])).toMatch(/дважды/)
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("чужой отдел — понятный отказ, без ложного успеха", async () => {
    apiRequest.mockImplementation(async () => {
      throw new ApiError("forbidden", "own department only")
    })
    expect(await saveLayoutAction("d-2", blocks)).toMatch(/своего отдела/)
  })
})
