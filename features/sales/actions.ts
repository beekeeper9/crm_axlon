"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { leadRoute, routes } from "@/config/routes"
import {
  assignDeal,
  createDeal,
  moveDealStage,
  paymentKindSchema,
  recordPayment,
  reopenDeal,
  updateDeal,
} from "@/features/sales/api/deal-mutations"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

export type DealActionResult<T = null> = { ok: true; data: T } | { ok: false; message: string; requestId: string | null }

const DEMO_ONLY = { ok: false as const, message: "В демо-режиме сделки на сервер не сохраняются.", requestId: null }

/** Ответы backend на английском → понятные сообщения */
const BACKEND_MESSAGES: Array<[RegExp, string]> = [
  [/payment/i, "Закрыть сделку успешно можно только после оплаты — внесите оплату во вкладке «Оплата»."],
  [/reason/i, "Укажите причину отказа."],
  [/closed|not open/i, "Сделка уже закрыта — сначала откройте её снова."],
  [/department|team/i, "Передать сделку можно только сотруднику своего отдела."],
]

function failure(error: unknown): DealActionResult<never> {
  if (!(error instanceof ApiError)) throw error
  const requestId = error.requestId ?? null
  if (error.code === "subscription_inactive" || error.code === "feature_not_in_plan") {
    return { ok: false, message: apiErrorMessage(error), requestId }
  }
  if (error.kind === "conflict" && /version|modified|changed/i.test(error.message)) {
    return { ok: false, message: "Сделку уже изменил кто-то другой. Обновите страницу и повторите.", requestId }
  }
  if (error.kind === "not_found") return { ok: false, message: "Сделка недоступна: возможно, её передали другому сотруднику.", requestId }
  if (error.kind === "forbidden") return { ok: false, message: "У вашей роли нет права на это действие со сделкой.", requestId }
  const known = BACKEND_MESSAGES.find(([pattern]) => pattern.test(error.message))
  return { ok: false, message: known?.[1] ?? apiErrorMessage(error), requestId }
}

async function run<T>(dealId: string | null, operation: () => Promise<T>): Promise<DealActionResult<T>> {
  if (isMockDataSource) return DEMO_ONLY
  try {
    const data = await operation()
    revalidatePath(routes.sales)
    if (dealId) revalidatePath(leadRoute(dealId))
    return { ok: true, data }
  } catch (error) {
    return failure(error)
  }
}

const amountSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, "").replace(",", "."))
  .refine((value) => /^\d{1,13}(\.\d{1,2})?$/.test(value), "Сумма — число, например 15000 или 15000.50")

const invalid = (error: z.ZodError) => ({ ok: false as const, message: error.issues[0]?.message ?? "Проверьте поля", requestId: null })

const newDealSchema = z.object({
  title: z.string().trim().min(2, "Укажите название сделки").max(200, "Не длиннее 200 символов"),
  amount: amountSchema,
  pipelineId: z.string().nullable(),
  nextStep: z.string().trim().max(300, "Не длиннее 300 символов"),
})

export async function createDealAction(input: z.input<typeof newDealSchema>): Promise<DealActionResult<string>> {
  const parsed = newDealSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return run(null, async () =>
    createDeal(await getActionAuth(), { ...parsed.data, customerId: null, nextStep: parsed.data.nextStep || null })
  )
}

const dealChangesSchema = z.object({
  title: z.string().trim().min(2, "Укажите название сделки").max(200, "Не длиннее 200 символов"),
  amount: amountSchema,
  nextStep: z.string().trim().max(300, "Не длиннее 300 символов"),
  expectedCloseDate: z.union([z.iso.date(), z.literal("")]),
})

export async function updateDealAction(
  dealId: string,
  version: number,
  input: z.input<typeof dealChangesSchema>
): Promise<DealActionResult> {
  const parsed = dealChangesSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return run(dealId, async () => {
    await updateDeal(await getActionAuth(), dealId, { ...parsed.data, expectedCloseDate: parsed.data.expectedCloseDate || null }, version)
    return null
  })
}

/** Смена этапа; для этапа отказа нужна причина из справочника (комментарий — по желанию) */
export async function moveDealStageAction(
  dealId: string,
  stageId: string,
  loss: { lossReasonId: string | null; comment: string } | null = null
): Promise<DealActionResult> {
  return run(dealId, async () => {
    await moveDealStage(await getActionAuth(), dealId, stageId, loss && { lossReasonId: loss.lossReasonId, reason: loss.comment.trim() })
    return null
  })
}

export async function reopenDealAction(dealId: string): Promise<DealActionResult> {
  return run(dealId, async () => {
    await reopenDeal(await getActionAuth(), dealId)
    return null
  })
}

export async function assignDealAction(dealId: string, ownerUserId: string): Promise<DealActionResult> {
  return run(dealId, async () => {
    await assignDeal(await getActionAuth(), dealId, ownerUserId)
    return null
  })
}

const paymentSchema = z.object({
  amount: amountSchema,
  kind: paymentKindSchema,
  paidOn: z.iso.date("Укажите дату оплаты"),
  isRefund: z.boolean(),
  reference: z.string().min(8),
})

export async function recordPaymentAction(
  dealId: string,
  customerId: string | null,
  input: z.input<typeof paymentSchema>
): Promise<DealActionResult> {
  const parsed = paymentSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return run(dealId, async () => {
    await recordPayment(await getActionAuth(), { dealId, customerId, ...parsed.data })
    return null
  })
}
