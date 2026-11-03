import { describe, expect, it } from "vitest"

import { currencyOptions, distributionStatus, fromCents, parseTarget, toCents } from "@/features/departments/lib/plan-distribution"

describe("распределение плана компании", () => {
  it("считает распределённое и остаток без ошибок плавающей точки", () => {
    expect(distributionStatus("10", ["6", "4"])).toEqual({ distributed: "10", remaining: "0", isExact: true })
    expect(distributionStatus("1000.10", ["500.05", "300"])).toEqual({ distributed: "800.05", remaining: "200.05", isExact: false })
    expect(distributionStatus("10", ["7", "5"]).remaining).toBe("-2")
  })

  it("разбирает ввод цели", () => {
    expect(parseTarget("1 500 000")).toBe("1500000")
    expect(parseTarget("12,5")).toBe("12.5")
    expect(parseTarget("")).toBeNull()
    expect(parseTarget("abc")).toBeNull()
    expect(toCents("0.1") + toCents("0.2")).toBe(toCents("0.3"))
    expect(fromCents(150)).toBe("1.50")
  })

  it("валюта компании первой в списке, без повторов", () => {
    const options = currencyOptions("USD")
    expect(options[0]).toBe("USD")
    expect(new Set(options).size).toBe(options.length)
  })
})
