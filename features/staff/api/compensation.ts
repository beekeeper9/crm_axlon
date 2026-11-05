import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"
import { paginatedSchema } from "@/lib/api/pagination"

/**
 * Условия оплаты сотрудника (`/plans/compensation/`): оклад в месяц и процент от подтверждённых
 * денег, которые он получил за месяц. Задаёт и видит только директор; менеджер видит свой
 * заработок в «Моём дне».
 */

const termsSchema = z.object({
  userId: z.string(),
  baseSalary: decimalStringSchema,
  commissionPercent: decimalStringSchema,
  currency: currencyCodeSchema,
  updatedAt: z.iso.datetime({ offset: true }),
})

export type PayTerms = z.infer<typeof termsSchema>

export async function fetchPayTerms(auth: ApiAuth, userId: string): Promise<PayTerms | null> {
  const page = await apiRequest("/api/v1/plans/compensation/", { auth, schema: paginatedSchema(termsSchema) })
  return page.results.find((terms) => terms.userId === userId) ?? null
}

export async function setPayTerms(auth: ApiAuth, userId: string, terms: { baseSalary: string; commissionPercent: string }): Promise<PayTerms> {
  return apiRequest(`/api/v1/plans/compensation/${encodeURIComponent(userId)}/`, { method: "PUT", auth, body: terms, schema: termsSchema })
}
