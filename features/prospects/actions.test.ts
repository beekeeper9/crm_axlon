import { beforeEach, describe, expect, it, vi } from "vitest"

const convertLead = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({ tenant: "demo" }) }))
vi.mock("@/features/prospects/api/prospects-repository", () => ({
  convertLead: (...args: unknown[]) => convertLead(...args),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  assignLead: vi.fn(),
  qualifyLead: vi.fn(),
  disqualifyLead: vi.fn(),
  addProspectNote: vi.fn(),
}))

const { convertProspectAction, createProspectAction, disqualifyProspectAction } = await import("@/features/prospects/actions")
const { ApiError } = await import("@/lib/api/errors")

const deal = { title: "Окна", amount: "1500,50", pipelineId: "p-1", stageId: "s-2", nextStepTitle: "Перезвонить по КП", nextStepDue: "2026-11-10" }

describe("convertProspectAction", () => {
  beforeEach(() => convertLead.mockReset())

  it("к существующему клиенту: сделка с этапом и следующим шагом, сумма с запятой нормализуется", async () => {
    convertLead.mockResolvedValueOnce({ customerId: "c-1", alreadyConverted: false, dealId: "d-1" })
    const result = await convertProspectAction("l-1", { customerId: "c-1", deal })
    expect(convertLead).toHaveBeenCalledWith({ tenant: "demo" }, "l-1", {
      customerId: "c-1",
      deal: { title: "Окна", amount: "1500.50", pipelineId: "p-1", stageId: "s-2", productId: null, nextStep: { title: "Перезвонить по КП", dueDate: "2026-11-10" } },
    })
    expect(result).toEqual({ ok: true, data: { customerId: "c-1", alreadyConverted: false, dealId: "d-1" } })
  })

  it("неверная сумма не уходит на сервер", async () => {
    const result = await convertProspectAction("l-1", { customerId: null, deal: { ...deal, amount: "много" } })
    expect(result.ok).toBe(false)
    expect(convertLead).not.toHaveBeenCalled()
  })

  it("без следующего шага конвертировать нельзя", async () => {
    const result = await convertProspectAction("l-1", { customerId: null, deal: { ...deal, nextStepTitle: "", nextStepDue: "" } })
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/Следующий шаг/) })
    expect(convertLead).not.toHaveBeenCalled()
  })

  it("неквалифицированный лид — понятное сообщение вместо текста backend", async () => {
    convertLead.mockRejectedValueOnce(new ApiError("conflict", "Only a qualified lead can be converted."))
    const result = await convertProspectAction("l-1", { customerId: null, deal })
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/квалифицируйте/) })
  })
})

describe("валидация на входе", () => {
  it("лид без телефона и e-mail не создаётся", async () => {
    const result = await createProspectAction({ name: "Айжан", phone: "", email: "", source: "phone" })
    expect(result).toMatchObject({ ok: false, message: "Нужен телефон или e-mail" })
  })

  it("причина отказа обязательна", async () => {
    expect(await disqualifyProspectAction("l-1", " ")).toMatchObject({ ok: false })
  })
})
