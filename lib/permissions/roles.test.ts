import { describe, expect, it } from "vitest"

import { hasPermission } from "@/lib/permissions/roles"

describe("права найма сотрудников", () => {
  it("РОП нанимает напрямую, без заявки директору", () => {
    expect(hasPermission("head_of_sales", "staff.hire")).toBe(true)
  })

  it("решения по заявкам принимает только директор", () => {
    expect(hasPermission("director", "staff.approve")).toBe(true)
    expect(hasPermission("head_of_sales", "staff.approve")).toBe(false)
  })

  it("менеджер не нанимает и не видит управление сотрудниками", () => {
    expect(hasPermission("manager", "staff.hire")).toBe(false)
    expect(hasPermission("manager", "staff.manage")).toBe(false)
  })
})

describe("права на чаты", () => {
  it("чаты видят директор, РОП и менеджер", () => {
    expect(hasPermission("director", "chats.view")).toBe(true)
    expect(hasPermission("head_of_sales", "chats.view")).toBe(true)
    expect(hasPermission("manager", "chats.view")).toBe(true)
    expect(hasPermission("platform_admin", "chats.view")).toBe(false)
  })

  it("подключают WhatsApp директор и РОП, но не менеджер", () => {
    expect(hasPermission("director", "chats.connect")).toBe(true)
    expect(hasPermission("head_of_sales", "chats.connect")).toBe(true)
    expect(hasPermission("manager", "chats.connect")).toBe(false)
  })
})
