import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const moveDealStage = vi.fn()
const updateDeal = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}) }))
vi.mock("@/features/sales/api/deal-mutations", async (original) => ({
  ...(await original<typeof import("@/features/sales/api/deal-mutations")>()),
  moveDealStage: (...args: unknown[]) => moveDealStage(...args),
  updateDeal: (...args: unknown[]) => updateDeal(...args),
}))

const { moveDealStageAction, updateDealAction } = await import("@/features/sales/actions")

describe("действия со сделкой", () => {
  beforeEach(() => {
    moveDealStage.mockReset()
    updateDeal.mockReset()
  })

  it("модуль вне тарифа — сообщение о тарифе, без ложного успеха", async () => {
    moveDealStage.mockRejectedValue(new ApiError("forbidden", "not in plan", { code: "feature_not_in_plan" }))
    const result = await moveDealStageAction("d-1", "s-2")
    expect(result.ok).toBe(false)
    expect(!result.ok && result.message).toMatch(/тариф/)
  })

  it("конфликт версии — просим обновить, а не затираем чужие правки", async () => {
    updateDeal.mockRejectedValue(new ApiError("conflict", "Deal was modified by someone else"))
    const result = await updateDealAction("d-1", 3, { title: "Окна", amount: "1000", nextStep: "", expectedCloseDate: "" })
    expect(!result.ok && result.message).toMatch(/изменил кто-то другой/)
  })

  it("сумма проверяется до запроса", async () => {
    const result = await updateDealAction("d-1", 3, { title: "Окна", amount: "дорого", nextStep: "", expectedCloseDate: "" })
    expect(result.ok).toBe(false)
    expect(updateDeal).not.toHaveBeenCalled()
  })

  it("для отказа передаётся причина из справочника", async () => {
    moveDealStage.mockResolvedValue(undefined)
    await moveDealStageAction("d-1", "s-lost", { lossReasonId: "r-1", comment: " дорого " })
    expect(moveDealStage).toHaveBeenCalledWith({}, "d-1", "s-lost", { lossReasonId: "r-1", reason: "дорого" })
  })
})
