import { beforeEach, describe, expect, it, vi } from "vitest"

const recordPaymentWithReceipt = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}) }))
vi.mock("@/features/payments/api/payments-api", () => ({
  recordPaymentWithReceipt: (...args: unknown[]) => recordPaymentWithReceipt(...args),
}))

const { POST } = await import("@/app/payment-receipts/route")

const DEAL = "6f1c2c56-0d7c-4d63-9a0e-3c1f4f2f3c11"
const REF = "0b8c5a8e-6f0e-4f87-9d5a-2d0c3b4e5f60"

function request(fields: Record<string, string>, receipt?: File) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  if (receipt) form.set("receipt", receipt)
  return new Request("http://crm.test/payment-receipts", { method: "POST", body: form })
}

const base = { deal_id: DEAL, amount: "15 000,50", kind: "prepayment", paid_on: "2026-11-03", reference: REF, close_sale: "true" }
const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "чек.pdf", { type: "application/pdf" })

describe("BFF оплаты с чеком", () => {
  beforeEach(() => recordPaymentWithReceipt.mockReset())

  it("без чека оплата не уходит в backend", async () => {
    const response = await POST(request(base))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, message: expect.stringMatching(/Прикрепите чек/) })
    expect(recordPaymentWithReceipt).not.toHaveBeenCalled()
  })

  it("пересылает только разрешённые поля, сумму в формате backend и файл", async () => {
    recordPaymentWithReceipt.mockResolvedValue({ status: "pending_verification", dealId: DEAL })
    const response = await POST(request({ ...base, owner_user_id: "someone-else" }, pdf()))
    expect(await response.json()).toEqual({ ok: true, status: "pending_verification" })
    const form = recordPaymentWithReceipt.mock.calls[0]?.[1] as FormData
    expect(form.get("amount")).toBe("15000.50")
    expect(form.get("close_sale")).toBe("true")
    expect(form.has("owner_user_id")).toBe(false)
    expect((form.get("receipt") as File).name).toBe("чек.pdf")
  })

  it("возврат можно внести без документа", async () => {
    recordPaymentWithReceipt.mockResolvedValue({ status: "confirmed", dealId: DEAL })
    const response = await POST(request({ ...base, close_sale: "false", is_refund: "true" }))
    expect(await response.json()).toEqual({ ok: true, status: "confirmed" })
  })
})
