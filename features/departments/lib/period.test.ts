import { describe, expect, it } from "vitest"

import { periodFrom } from "@/features/departments/lib/period"

describe("период фильтра", () => {
  it("по умолчанию — с начала месяца по сегодня", () => {
    expect(periodFrom({}, "2026-11-03")).toEqual({ from: "2026-11-01", to: "2026-11-03", month: "2026-11" })
  })

  it("берёт даты из адреса; начало позже конца — с начала месяца конца", () => {
    expect(periodFrom({ from: "2026-10-05", to: "2026-10-20" }, "2026-11-03")).toEqual({ from: "2026-10-05", to: "2026-10-20", month: "2026-10" })
    expect(periodFrom({ from: "2026-10-25", to: "2026-10-20" }, "2026-11-03").from).toBe("2026-10-01")
    expect(periodFrom({ from: "мусор" }, "2026-11-03").from).toBe("2026-11-01")
  })
})
