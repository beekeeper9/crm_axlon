import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { submitPayment } from "@/features/payments/api/record-payment"
import { paymentErrorMessage } from "@/features/payments/messages"
import { formatFileSize, paymentSchema, receiptHref, receiptProblem } from "@/features/payments/schemas"
import { ApiError } from "@/lib/api/errors"

describe("проверка чека до отправки", () => {
  it("принимает PDF и фото до 10 МБ", () => {
    expect(receiptProblem({ name: "чек.pdf", size: 1200 })).toBeNull()
    expect(receiptProblem({ name: "IMG_0001.HEIC", size: 3_000_000 })).toBeNull()
    expect(receiptProblem({ name: "photo.jpeg", size: 10 * 1024 * 1024 })).toBeNull()
  })

  it("отклоняет пустой, слишком большой и не тот тип", () => {
    expect(receiptProblem({ name: "чек.pdf", size: 0 })).toMatch(/пустой/)
    expect(receiptProblem({ name: "чек.pdf", size: 10 * 1024 * 1024 + 1 })).toMatch(/10 МБ/)
    expect(receiptProblem({ name: "чек.docx", size: 100 })).toMatch(/PDF или фото/)
  })

  it("размер файла подписан по-русски", () => {
    expect(formatFileSize(512)).toBe("512 Б")
    expect(formatFileSize(2048)).toBe("2 КБ")
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1,5 МБ")
  })

  it("чек открывается через BFF, а не напрямую из backend", () => {
    expect(receiptHref("p 1")).toBe("/payment-receipts/p%201")
    expect(receiptHref("p1", true)).toBe("/payment-receipts/p1?download=1")
  })
})

describe("ответ backend по оплате", () => {
  it("разбирает оплату с чеком и статусом проверки", () => {
    const payment = paymentSchema.parse({
      id: "p1",
      amount: "400.00",
      currency: "KGS",
      kind: "prepayment",
      paidOn: "2026-11-03",
      sellerUserId: "u1",
      ownerUserId: "u1",
      dealId: "d1",
      isRefund: false,
      createdAt: "2026-11-03T10:00:00+00:00",
      status: "pending_verification",
      closeSale: true,
      verifiedAt: null,
      verifiedByUserId: null,
      verificationMethod: null,
      rejectionReason: null,
      receipt: { id: "r1", contentType: "application/pdf", size: 120, filename: "чек.pdf", sha256: "x", uploadedByUserId: "u1", uploadedAt: "2026-11-03T10:00:00+00:00" },
      canVerify: false,
    })
    expect(payment.status).toBe("pending_verification")
    expect(payment.receipt?.filename).toBe("чек.pdf")
  })
})

describe("сообщения об ошибках оплаты", () => {
  it("без чека и с негодным файлом — по коду backend", () => {
    expect(paymentErrorMessage(new ApiError("validation", "x", { code: "receipt_required" }))).toMatch(/Прикрепите чек/)
    expect(paymentErrorMessage(new ApiError("validation", "x", { code: "receipt_invalid" }))).toMatch(/PDF или фото/)
  })

  it("свою оплату подтвердить нельзя", () => {
    const error = new ApiError("forbidden", "You cannot confirm a payment you made or recorded yourself.")
    expect(paymentErrorMessage(error)).toMatch(/Свою оплату/)
  })

  it("повторное решение — просим обновить страницу", () => {
    expect(paymentErrorMessage(new ApiError("conflict", "x", { code: "payment_already_verified" }))).toMatch(/уже проверили/)
  })
})

describe("отправка оплаты с чеком", () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  const input = {
    dealId: "d1",
    customerId: null,
    amount: "400",
    kind: "prepayment" as const,
    paidOn: "2026-11-03",
    isRefund: false,
    closeSale: true,
    reference: "ref-1",
    receipt: new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "чек.pdf", { type: "application/pdf" }),
  }

  it("уходит multipart в BFF с полями в snake_case и файлом", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, status: "pending_verification" })))
    const result = await submitPayment(input)
    expect(result).toEqual({ ok: true, status: "pending_verification" })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/payment-receipts")
    const form = init.body as FormData
    expect(form.get("deal_id")).toBe("d1")
    expect(form.get("close_sale")).toBe("true")
    expect(form.has("customer_id")).toBe(false)
    expect((form.get("receipt") as File).name).toBe("чек.pdf")
  })

  it("ошибка BFF доходит до формы, неожиданный ответ — без ложного успеха", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, message: "Прикрепите чек" }), { status: 400 }))
    expect(await submitPayment(input)).toEqual({ ok: false, message: "Прикрепите чек" })
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 502 }))
    expect((await submitPayment(input)).ok).toBe(false)
    fetchMock.mockRejectedValueOnce(new TypeError("offline"))
    expect(await submitPayment(input)).toEqual({ ok: false, message: expect.stringMatching(/Нет связи/) })
  })
})
