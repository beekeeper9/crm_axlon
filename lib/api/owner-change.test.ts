import { describe, expect, it } from "vitest"

import { ownerChangeSchema, ownerChangeText } from "@/lib/api/owner-change"

describe("ownerChangeText", () => {
  it("называет прежнего и нового ответственного", () => {
    const change = ownerChangeSchema.parse({ fromOwner: { id: "u-1", name: "Айбек" }, toOwner: { id: "u-2", name: "Нурлан" } })
    expect(ownerChangeText(change)).toBe("от Айбек к Нурлан")
  })

  it("без деталей — не передача", () => {
    expect(ownerChangeText(ownerChangeSchema.parse(undefined))).toBeNull()
  })

  it("неизвестное имя не выдумывается", () => {
    expect(ownerChangeText({ fromOwner: { id: "u-1", name: null }, toOwner: { id: "u-2", name: "Нурлан" } })).toBe("от сотрудник к Нурлан")
  })
})
