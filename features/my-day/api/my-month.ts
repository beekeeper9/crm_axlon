import { cache } from "react"
import { z } from "zod"

import { apiRequest } from "@/lib/api/client"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"
import { getRenderAuth } from "@/lib/auth/token-store"

/**
 * `GET /team/my-month/` — свой месяц менеджера: продажи, деньги по видам оплат, встречи,
 * заработок по условиям директора и блоки продуктов. Всё считает backend в валюте компании.
 */

const moneySchema = z.object({
  prepayments: decimalStringSchema,
  additional: decimalStringSchema,
  full: decimalStringSchema,
  refunds: decimalStringSchema,
  received: decimalStringSchema,
})

export const myMonthSchema = z.object({
  month: z.string(),
  start: z.iso.date(),
  end: z.iso.date(),
  asOf: z.iso.datetime({ offset: true }),
  currency: currencyCodeSchema,
  sales: z.int().nonnegative(),
  previousSales: z.int().nonnegative(),
  newClients: z.int().nonnegative(),
  turnover: decimalStringSchema,
  debt: decimalStringSchema,
  averageCheck: decimalStringSchema.nullable(),
  money: moneySchema,
  targets: z.object({ sales: decimalStringSchema.nullable(), turnover: decimalStringSchema.nullable() }),
  meetings: z.object({
    assigned: z.int().nonnegative(),
    passed: z.int().nonnegative(),
    ahead: z.int().nonnegative(),
    held: z.int().nonnegative(),
    attendancePercent: decimalStringSchema.nullable(),
    salesPerMeetingPercent: decimalStringSchema.nullable(),
  }),
  earnings: z
    .object({
      baseSalary: decimalStringSchema,
      commissionPercent: decimalStringSchema,
      commission: decimalStringSchema,
      total: decimalStringSchema,
    })
    .nullable(),
  products: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      sales: z.int().nonnegative(),
      previousSales: z.int().nonnegative(),
      turnover: decimalStringSchema,
      averageCheck: decimalStringSchema.nullable(),
      money: moneySchema,
    })
  ),
})

export type MyMonth = z.infer<typeof myMonthSchema>

/** Один запрос на отрисовку: блоки «Оборот и заработок» и «Этот месяц» берут одни данные */
export const fetchMyMonth = cache(async (): Promise<MyMonth> => {
  return apiRequest("/api/v1/team/my-month/", { auth: await getRenderAuth(), schema: myMonthSchema })
})

/** Доля в процентах (целое) или null, когда делить не на что */
export function percentOf(value: string | number, whole: string | number | null): number | null {
  const base = Number(whole)
  if (whole === null || !(base > 0)) return null
  return Math.round((Number(value) / base) * 100)
}
