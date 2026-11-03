import { z } from "zod"

import { dealPaymentSummarySchema, paymentSchema, type DealPaymentSummary, type Payment } from "@/features/payments/schemas"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { PAGE_LIMIT_MAX, paginatedSchema } from "@/lib/api/pagination"

const paymentPageSchema = paginatedSchema(paymentSchema)
export type PaymentPage = z.infer<typeof paymentPageSchema>

/** `GET /payments/?deal_id` — вся история оплат сделки, которую видит пользователь */
export function listDealPayments(auth: ApiAuth, dealId: string): Promise<PaymentPage> {
  return apiRequest("/api/v1/payments/", { auth, query: { dealId, limit: PAGE_LIMIT_MAX }, schema: paymentPageSchema })
}

/** `GET /payments/deals/{id}/summary/` — сумма сделки, подтверждённые деньги, на проверке, долг */
export function loadDealPaymentSummary(auth: ApiAuth, dealId: string): Promise<DealPaymentSummary> {
  return apiRequest(`/api/v1/payments/deals/${encodeURIComponent(dealId)}/summary/`, { auth, schema: dealPaymentSummarySchema })
}

/** `GET /payments/review/` — очередь «Проверка оплат» (РОП — свой отдел, директор — все) */
export function listPaymentsForReview(auth: ApiAuth): Promise<PaymentPage> {
  return apiRequest("/api/v1/payments/review/", { auth, query: { limit: PAGE_LIMIT_MAX }, schema: paymentPageSchema })
}

export function confirmPayment(auth: ApiAuth, paymentId: string): Promise<Payment> {
  return apiRequest(`/api/v1/payments/${encodeURIComponent(paymentId)}/confirm/`, { method: "POST", auth, schema: paymentSchema })
}

export function rejectPayment(auth: ApiAuth, paymentId: string, reason: string): Promise<Payment> {
  return apiRequest(`/api/v1/payments/${encodeURIComponent(paymentId)}/reject/`, {
    method: "POST",
    auth,
    body: { reason },
    schema: paymentSchema,
  })
}

/**
 * `POST /payments/` (multipart) — оплата с чеком. Поля формы уже в snake_case: deal_id, amount,
 * kind, paid_on, is_refund, close_sale, reference, receipt.
 */
export function recordPaymentWithReceipt(auth: ApiAuth, form: FormData): Promise<Payment> {
  return apiRequest("/api/v1/payments/", { method: "POST", auth, body: form, schema: paymentSchema })
}
