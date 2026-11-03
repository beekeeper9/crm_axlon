import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"

/**
 * Изменения сделки через backend (`/sales/deals/…`). Правила (лимиты, обязательная причина
 * отказа, «выигрыш только с оплатой», права по роли и отделу) проверяет сервер; конфликт
 * версии — 409, и интерфейс не затирает чужие правки.
 */

const dealRefSchema = z.object({ id: z.string(), version: z.int() })

const path = (dealId: string, action = "") => `/api/v1/sales/deals/${encodeURIComponent(dealId)}/${action}`

export type NewDeal = {
  title: string
  amount: string
  pipelineId: string | null
  customerId: string | null
  nextStep: string | null
}

export async function createDeal(auth: ApiAuth, deal: NewDeal): Promise<string> {
  const created = await apiRequest("/api/v1/sales/deals/", {
    method: "POST",
    auth,
    body: {
      title: deal.title,
      amount: deal.amount,
      ...(deal.pipelineId ? { pipelineId: deal.pipelineId } : {}),
      ...(deal.customerId ? { customerId: deal.customerId } : {}),
      ...(deal.nextStep ? { nextStep: deal.nextStep } : {}),
    },
    schema: dealRefSchema,
  })
  return created.id
}

export type DealChanges = {
  title: string
  amount: string
  nextStep: string
  expectedCloseDate: string | null
  /** Откуда пришёл клиент; пустая строка очищает, без поля — не меняется */
  source?: string
}

/** `PATCH` с версией: если сделку успели изменить, backend ответит 409 */
export async function updateDeal(auth: ApiAuth, dealId: string, changes: DealChanges, version: number): Promise<void> {
  await apiRequest(path(dealId), {
    method: "PATCH",
    auth,
    body: { ...changes, version },
    schema: dealRefSchema,
  })
}

/** Смена этапа; этап вида won/lost закрывает сделку (для lost backend требует причину) */
export async function moveDealStage(
  auth: ApiAuth,
  dealId: string,
  stageId: string,
  loss: { lossReasonId: string | null; reason: string } | null
): Promise<void> {
  await apiRequest(path(dealId, "stage/"), {
    method: "POST",
    auth,
    body: {
      stageId,
      ...(loss?.lossReasonId ? { lossReasonId: loss.lossReasonId } : {}),
      ...(loss?.reason ? { reason: loss.reason } : {}),
    },
    schema: dealRefSchema,
  })
}

export async function reopenDeal(auth: ApiAuth, dealId: string): Promise<void> {
  await apiRequest(path(dealId, "reopen/"), { method: "POST", auth, schema: dealRefSchema })
}

export async function assignDeal(auth: ApiAuth, dealId: string, ownerUserId: string): Promise<void> {
  await apiRequest(path(dealId, "assign/"), { method: "POST", auth, body: { ownerUserId }, schema: dealRefSchema })
}

export const paymentKindSchema = z.enum(["prepayment", "additional", "full"])

export const dealPaymentSchema = z.object({
  id: z.string(),
  amount: decimalStringSchema,
  currency: currencyCodeSchema,
  kind: z.string(),
  paidOn: z.iso.date(),
  sellerUserId: z.string().nullable(),
  isRefund: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
})

export type DealPayment = z.infer<typeof dealPaymentSchema>

export type NewPayment = {
  dealId: string
  customerId: string | null
  amount: string
  kind: z.infer<typeof paymentKindSchema>
  paidOn: string
  isRefund: boolean
  /** Ключ идемпотентности: повтор отправки не создаёт второй платёж */
  reference: string
}

/** `POST /payments/` — оплата или возврат по сделке; продавец по умолчанию — тот, кто вносит */
export async function recordPayment(auth: ApiAuth, payment: NewPayment): Promise<void> {
  await apiRequest("/api/v1/payments/", {
    method: "POST",
    auth,
    body: {
      dealId: payment.dealId,
      ...(payment.customerId ? { customerId: payment.customerId } : {}),
      amount: payment.amount,
      kind: payment.kind,
      paidOn: payment.paidOn,
      isRefund: payment.isRefund,
      reference: payment.reference,
    },
    schema: z.object({ id: z.string() }),
  })
}
