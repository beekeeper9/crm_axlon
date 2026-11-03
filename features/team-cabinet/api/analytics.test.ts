import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/token-store", () => ({ getRenderAuth: vi.fn() }))

const { changeLabel } = await import("@/features/team-cabinet/api/analytics")

describe("changeLabel", () => {
  it("shows the signed difference to the previous period", () => {
    expect(changeLabel(5, 3)).toBe("+2 к прошлому периоду")
    expect(changeLabel(1, 4)).toBe("−3 к прошлому периоду")
  })

  it("says nothing when both periods are empty", () => {
    expect(changeLabel(0, 0)).toBeNull()
    expect(changeLabel(2, 2)).toBe("без изменений")
  })
})
