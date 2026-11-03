import { describe, expect, it } from "vitest"

import { linePath } from "@/components/shared/inline-charts"

describe("linePath", () => {
  const x = (index: number) => index * 10
  const y = (value: number) => 100 - value

  it("draws a polyline through the points", () => {
    expect(linePath([0, 50, 100], x, y)).toBe("M0.0,100.0 L10.0,50.0 L20.0,0.0")
  })

  it("breaks the line on gaps", () => {
    expect(linePath([10, null, 30, 40], x, y)).toBe("M0.0,90.0 M20.0,70.0 L30.0,60.0")
  })
})
