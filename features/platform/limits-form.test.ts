import { describe, expect, it } from "vitest"

import { limitRows, limitsPayload } from "@/features/platform/limits-form"

const METRICS = [
  { metric: "users", used: 4, limit: 5, state: "warning", overridden: false },
  { metric: "customers", used: 10, limit: -1, state: "ok", overridden: true },
  { metric: "deals", used: null, limit: 100, state: "ok", overridden: false },
] as const

describe("редактор лимитов компании", () => {
  it("уходят только изменённые метрики; «без лимита» — -1", () => {
    const rows = limitRows([...METRICS])
    expect(limitsPayload(rows)).toEqual({ customers: -1 })
    rows[0] = { ...rows[0], custom: true, value: " 12 " }
    expect(limitsPayload(rows)).toEqual({ users: 12, customers: -1 })
  })

  it("не целое число — null, запрос не отправляется", () => {
    const rows = limitRows([...METRICS])
    rows[2] = { ...rows[2], custom: true, value: "1.5" }
    expect(limitsPayload(rows)).toBeNull()
  })
})
