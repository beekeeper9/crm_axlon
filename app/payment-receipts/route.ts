import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { leadRoute } from "@/config/routes"
import { recordPaymentWithReceipt } from "@/features/payments/api/payments-api"
import { paymentErrorMessage } from "@/features/payments/messages"
import { PAYMENT_REVIEW_PATH } from "@/features/payments/paths"
import { paymentKindSchema, receiptProblem } from "@/features/payments/schemas"
import type { RecordPaymentResponse } from "@/features/payments/api/record-payment"
import { getActionAuth } from "@/lib/auth/token-store"

const fieldsSchema = z.object({
  deal_id: z.uuid(),
  customer_id: z.uuid().optional(),
  amount: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, "").replace(",", "."))
    .refine((value) => /^\d{1,13}(\.\d{1,2})?$/.test(value) && Number(value) > 0, "Сумма — положительное число, например 15000 или 15000.50"),
  kind: paymentKindSchema,
  paid_on: z.iso.date("Укажите дату оплаты"),
  is_refund: z.enum(["true", "false"]).default("false"),
  close_sale: z.enum(["true", "false"]).default("false"),
  reference: z.uuid(),
})

function reply(body: RecordPaymentResponse, status = 200) {
  return NextResponse.json(body, { status })
}

/**
 * Оплата с чеком (multipart) через BFF. Server Action здесь не подходит: у него предел тела
 * запроса 1 МБ, а чек может весить до 10 МБ. Решения о правах и проверке файла — на backend;
 * здесь только понятные сообщения до отправки и пересылка разрешённых полей.
 */
export async function POST(request: Request) {
  if (isMockDataSource) return reply({ ok: false, message: "В демо-режиме оплаты не сохраняются." }, 400)
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return reply({ ok: false, message: "Не удалось прочитать форму. Попробуйте ещё раз." }, 400)
  }
  const raw = Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === "string" && value !== ""))
  const parsed = fieldsSchema.safeParse(raw)
  if (!parsed.success) return reply({ ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля" }, 400)

  const receipt = form.get("receipt")
  const isRefund = parsed.data.is_refund === "true"
  if (receipt instanceof File && receipt.size > 0) {
    const problem = receiptProblem(receipt)
    if (problem) return reply({ ok: false, message: problem }, 400)
  } else if (!isRefund) {
    return reply({ ok: false, message: "Прикрепите чек: без чека оплата не уходит на проверку." }, 400)
  }

  const outgoing = new FormData()
  for (const [key, value] of Object.entries(parsed.data)) if (value !== undefined) outgoing.set(key, value)
  if (receipt instanceof File && receipt.size > 0) outgoing.set("receipt", receipt, receipt.name)

  try {
    const payment = await recordPaymentWithReceipt(await getActionAuth(), outgoing)
    revalidatePath(leadRoute(parsed.data.deal_id))
    revalidatePath(PAYMENT_REVIEW_PATH)
    return reply({ ok: true, status: payment.status })
  } catch (error) {
    return reply({ ok: false, message: paymentErrorMessage(error) }, 400)
  }
}
