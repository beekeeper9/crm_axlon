"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { leadRoute } from "@/config/routes"
import { confirmPayment, rejectPayment } from "@/features/payments/api/payments-api"
import { paymentErrorMessage } from "@/features/payments/messages"
import { PAYMENT_REVIEW_PATH } from "@/features/payments/paths"
import { getActionAuth } from "@/lib/auth/token-store"

export type PaymentActionResult = { ok: true } | { ok: false; message: string }

const DEMO_ONLY: PaymentActionResult = { ok: false, message: "В демо-режиме оплаты не проверяются." }

const reasonSchema = z.string().trim().min(3, "Напишите причину: менеджер увидит её в карточке сделки").max(500, "Не длиннее 500 символов")

function revalidate(dealId: string | null) {
  revalidatePath(PAYMENT_REVIEW_PATH)
  if (dealId) revalidatePath(leadRoute(dealId))
}

/** Подтвердить оплату по чеку: с этого момента она считается в продажах, KPI и планах */
export async function confirmPaymentAction(paymentId: string): Promise<PaymentActionResult> {
  if (isMockDataSource) return DEMO_ONLY
  try {
    const payment = await confirmPayment(await getActionAuth(), paymentId)
    revalidate(payment.dealId)
    return { ok: true }
  } catch (error) {
    return { ok: false, message: paymentErrorMessage(error) }
  }
}

/** Отклонить оплату: она остаётся в истории с причиной, менеджер получает уведомление */
export async function rejectPaymentAction(paymentId: string, reason: string): Promise<PaymentActionResult> {
  if (isMockDataSource) return DEMO_ONLY
  const parsed = reasonSchema.safeParse(reason)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Укажите причину" }
  try {
    const payment = await rejectPayment(await getActionAuth(), paymentId, parsed.data)
    revalidate(payment.dealId)
    return { ok: true }
  } catch (error) {
    return { ok: false, message: paymentErrorMessage(error) }
  }
}
