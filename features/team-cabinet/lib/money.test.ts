import { describe, expect, it } from "vitest"

import { cabinetMoney } from "@/features/team-cabinet/lib/money"

describe("cabinetMoney", () => {
  it("показывает валюту, которую вернул backend", () => {
    expect(cabinetMoney("1500.00", "USD")).toMatch(/\$|USD/)
  })

  it("без валюты в ответе — число без кода, а не чужая валюта", () => {
    expect(cabinetMoney(1500, null)).not.toMatch(/[A-Z]{3}|\$|сом/)
  })
})
