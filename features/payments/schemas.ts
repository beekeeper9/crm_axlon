import { z } from "zod"

import { PAYMENT_UPLOAD_PATH } from "@/features/payments/paths"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"

/**
 * Оплаты с чеком (решение владельца от 03.11.2026): каждая оплата приходит с чеком и
 * ждёт проверки; в KPI, планах и отчётах она считается только после подтверждения.
 * Все суммы и статусы считает backend — здесь только типы ответа и подписи.
 */

export const paymentStatusSchema = z.enum(["pending_verification", "confirmed", "rejected"])
export type PaymentStatus = z.infer<typeof paymentStatusSchema>

export const paymentKindSchema = z.enum(["prepayment", "additional", "full"])
export type PaymentKind = z.infer<typeof paymentKindSchema>

export const receiptInfoSchema = z.object({
  id: z.string(),
  contentType: z.string(),
  size: z.number().int().nonnegative(),
  filename: z.string(),
  uploadedByUserId: z.string(),
  uploadedAt: z.iso.datetime({ offset: true }),
})
export type ReceiptInfo = z.infer<typeof receiptInfoSchema>

export const paymentSchema = z.object({
  id: z.string(),
  amount: decimalStringSchema,
  currency: currencyCodeSchema,
  kind: paymentKindSchema,
  paidOn: z.iso.date(),
  sellerUserId: z.string(),
  ownerUserId: z.string(),
  dealId: z.string().nullable(),
  isRefund: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  status: paymentStatusSchema,
  closeSale: z.boolean(),
  verifiedAt: z.iso.datetime({ offset: true }).nullable(),
  verifiedByUserId: z.string().nullable(),
  verificationMethod: z.enum(["auto", "manual"]).nullable(),
  rejectionReason: z.string().nullable(),
  receipt: receiptInfoSchema.nullable(),
  canVerify: z.boolean(),
  deal: z.object({ id: z.string(), title: z.string(), amount: decimalStringSchema, currency: currencyCodeSchema }).optional(),
})
export type Payment = z.infer<typeof paymentSchema>

export const dealPaymentSummarySchema = z.object({
  dealId: z.string(),
  dealAmount: decimalStringSchema,
  currency: currencyCodeSchema,
  confirmedReceived: decimalStringSchema,
  pendingAmount: decimalStringSchema,
  refunded: decimalStringSchema,
  debt: decimalStringSchema,
  paymentsCount: z.number().int(),
  confirmedCount: z.number().int(),
  pendingCount: z.number().int(),
  rejectedCount: z.number().int(),
  prepaymentsCount: z.number().int(),
  otherCurrencies: z.array(z.string()),
})
export type DealPaymentSummary = z.infer<typeof dealPaymentSummarySchema>

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  prepayment: "Предоплата",
  additional: "Доплата",
  full: "Полная оплата",
}

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: "warning" | "success" | "danger" }> = {
  pending_verification: { label: "На проверке", tone: "warning" },
  confirmed: { label: "Подтверждена", tone: "success" },
  rejected: { label: "Отклонена", tone: "danger" },
}

/** Ограничения чека — те же, что проверяет backend (тип он определяет по содержимому файла) */
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024
export const RECEIPT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,.pdf,.jpg,.jpeg,.png,.webp,.heic"
const RECEIPT_EXTENSIONS = /\.(pdf|jpe?g|png|webp|heic)$/i

/** Проверка до отправки: понятная ошибка сразу, окончательное решение — за backend */
export function receiptProblem(file: { name: string; size: number }): string | null {
  if (file.size === 0) return "Файл пустой — выберите чек ещё раз."
  if (file.size > RECEIPT_MAX_BYTES) return "Чек больше 10 МБ — сожмите фото или сохраните PDF меньшего размера."
  if (!RECEIPT_EXTENSIONS.test(file.name)) return "Нужен PDF или фото чека (JPEG, PNG, WEBP, HEIC)."
  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`
}

/** Адрес чека через BFF: браузер не видит токен, права проверяет backend */
export function receiptHref(paymentId: string, download = false): string {
  return `${PAYMENT_UPLOAD_PATH}/${encodeURIComponent(paymentId)}${download ? "?download=1" : ""}`
}
