import { z } from "zod"

/**
 * Согласовано с backend: деньги — десятичная строка ("1500.00") и отдельный ISO-код валюты.
 * Во frontend сумма остаётся строкой: никаких расчётов через float.
 */
export const decimalStringSchema = z.string().regex(/^-?\d+(\.\d+)?$/, "Ожидается десятичная строка")

export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, "Ожидается ISO-код валюты")

export const moneySchema = z.object({
  amount: decimalStringSchema,
  currency: currencyCodeSchema,
})

export type Money = z.infer<typeof moneySchema>
