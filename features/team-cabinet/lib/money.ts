import { formatDecimal, formatDecimalMoney } from "@/lib/format"

/**
 * Денежная сумма кабинета. Backend складывает в ней только оплаты в валюте компании и
 * возвращает эту валюту; у старого ответа валюты нет — тогда число без кода.
 */
export function cabinetMoney(value: string | number, currency: string | null): string {
  const amount = typeof value === "number" ? value.toFixed(2) : value
  return currency ? formatDecimalMoney(amount, currency) : formatDecimal(Number(amount))
}
