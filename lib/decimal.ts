/**
 * Точное сложение денежных десятичных строк без float: "1500.50" + "99.5" = "1600.00".
 * Нужно только там, где frontend сам пересчитывает итог (демо-перенос сделки);
 * в реальном режиме итоги по этапам приходят от backend.
 */

const SCALE = 2
const FACTOR = BigInt(10 ** SCALE)

function toMinorUnits(value: string): bigint {
  const negative = value.startsWith("-")
  const [whole = "0", fraction = ""] = value.replace("-", "").split(".")
  const minor = BigInt(whole) * FACTOR + BigInt(fraction.padEnd(SCALE, "0").slice(0, SCALE) || "0")
  return negative ? -minor : minor
}

function fromMinorUnits(value: bigint): string {
  const negative = value < BigInt(0)
  const absolute = negative ? -value : value
  const whole = absolute / FACTOR
  const fraction = String(absolute % FACTOR).padStart(SCALE, "0")
  return `${negative ? "-" : ""}${whole}.${fraction}`
}

export function addDecimals(values: readonly string[]): string {
  return fromMinorUnits(values.reduce((sum, value) => sum + toMinorUnits(value), BigInt(0)))
}

export function subtractDecimal(from: string, value: string): string {
  return fromMinorUnits(toMinorUnits(from) - toMinorUnits(value))
}
