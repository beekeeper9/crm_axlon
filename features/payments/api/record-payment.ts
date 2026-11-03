import { z } from "zod"

import { PAYMENT_UPLOAD_PATH } from "@/features/payments/paths"
import { paymentStatusSchema } from "@/features/payments/schemas"

const responseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), status: paymentStatusSchema }),
  z.object({ ok: z.literal(false), message: z.string() }),
])

export type RecordPaymentResponse = z.infer<typeof responseSchema>

export type RecordPaymentInput = {
  dealId: string
  customerId: string | null
  amount: string
  kind: "prepayment" | "additional" | "full"
  paidOn: string
  isRefund: boolean
  /** Оплата внесена с этапа «Продажа»: после подтверждения сделка закрывается успешно */
  closeSale: boolean
  /** Ключ идемпотентности: повтор отправки не создаёт второй платёж */
  reference: string
  receipt: File | null
}

/**
 * Отправка оплаты с чеком из браузера в BFF (`app/payment-receipts/route.ts`), который
 * добавляет авторизацию и пересылает её в backend.
 */
export async function submitPayment(input: RecordPaymentInput): Promise<RecordPaymentResponse> {
  const form = new FormData()
  form.set("deal_id", input.dealId)
  if (input.customerId) form.set("customer_id", input.customerId)
  form.set("amount", input.amount)
  form.set("kind", input.kind)
  form.set("paid_on", input.paidOn)
  form.set("is_refund", String(input.isRefund))
  form.set("close_sale", String(input.closeSale))
  form.set("reference", input.reference)
  if (input.receipt) form.set("receipt", input.receipt, input.receipt.name)
  try {
    const response = await fetch(PAYMENT_UPLOAD_PATH, { method: "POST", body: form })
    const parsed = responseSchema.safeParse(await response.json().catch(() => null))
    if (parsed.success) return parsed.data
    return { ok: false, message: response.status === 413 ? "Файл слишком большой для отправки." : "Сервер ответил ошибкой. Попробуйте ещё раз." }
  } catch {
    return { ok: false, message: "Нет связи с сервером. Проверьте подключение к интернету." }
  }
}
