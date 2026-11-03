import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const apiRequest = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}) }))
const role = { current: "director" }
vi.mock("@/lib/session/current-user", () => ({ getCurrentUser: async () => ({ role: role.current }) }))

const { distributePlanAction, setPlansAction } = await import("@/features/departments/actions")

describe("планы директора", () => {
  beforeEach(() => {
    apiRequest.mockReset()
    role.current = "director"
  })

  it("денежный план уходит с валютой, количественный — без", async () => {
    apiRequest.mockResolvedValue({})
    const error = await setPlansAction({ scope: "company", scopeId: null, period: "2026-11", salesTarget: "20", moneyTarget: "1 500 000", currency: "USD" })
    expect(error).toBeNull()
    expect(apiRequest.mock.calls.map(([, options]) => (options as { body: unknown }).body)).toEqual([
      { scope: "company", period: "2026-11", metric: "monthly_sales", target: "20" },
      { scope: "company", period: "2026-11", metric: "monthly_turnover", target: "1500000", currency: "USD" },
    ])
  })

  it("пустое поле не меняет эту цель; РОП планы не меняет", async () => {
    apiRequest.mockResolvedValue({})
    await setPlansAction({ scope: "department", scopeId: "d-1", period: "2026-11", salesTarget: "5", moneyTarget: "", currency: "KGS" })
    expect(apiRequest).toHaveBeenCalledTimes(1)
    role.current = "head_of_sales"
    expect(await setPlansAction({ scope: "department", scopeId: "d-1", period: "2026-11", salesTarget: "5", moneyTarget: "", currency: "KGS" })).toMatch(/директор/)
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it("количество и деньги распределяются одним запросом; ошибка объясняется по-русски", async () => {
    apiRequest.mockRejectedValueOnce(new ApiError("validation", "The parts add up to 9, the company plan is 10."))
    const error = await distributePlanAction({
      period: "2026-11",
      distributions: [
        { metric: "monthly_sales", parts: [{ departmentId: "d-1", target: "9" }] },
        { metric: "monthly_turnover", currency: "USD", parts: [{ departmentId: "d-1", target: "1 000" }] },
      ],
    })
    expect(error).toMatch(/равна плану компании/)
    expect(apiRequest).toHaveBeenCalledTimes(1)
    const [path, options] = apiRequest.mock.calls[0] as [string, { body: unknown }]
    expect(path).toBe("/api/v1/plans/distribute/")
    expect(options.body).toEqual({
      period: "2026-11",
      distributions: [
        { metric: "monthly_sales", parts: [{ departmentId: "d-1", target: "9" }] },
        { metric: "monthly_turnover", currency: "USD", parts: [{ departmentId: "d-1", target: "1000" }] },
      ],
    })
  })

  it("валюта плана отдела, не совпадающая с компанией, объясняется", async () => {
    apiRequest.mockRejectedValueOnce(new ApiError("validation", "A department plan must be in the company plan currency (USD)."))
    const error = await setPlansAction({ scope: "department", scopeId: "d-1", period: "2026-11", salesTarget: "", moneyTarget: "100", currency: "KGS" })
    expect(error).toMatch(/валюте плана компании/)
  })

  it("доля отдела не число — запрос не уходит", async () => {
    const error = await distributePlanAction({ period: "2026-11", distributions: [{ metric: "monthly_sales", parts: [{ departmentId: "d-1", target: "пять" }] }] })
    expect(error).toMatch(/числа/)
    expect(apiRequest).not.toHaveBeenCalled()
  })
})
