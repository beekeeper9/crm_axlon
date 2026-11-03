import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const updateCustomer = vi.fn()
const customerMerge = vi.fn()
const searchCustomers = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/config/env", () => ({ isMockDataSource: false }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}) }))
vi.mock("@/features/clients/api/clients-repository", () => ({
  updateCustomer: (...args: unknown[]) => updateCustomer(...args),
  customerMerge: (...args: unknown[]) => customerMerge(...args),
  searchCustomers: (...args: unknown[]) => searchCustomers(...args),
}))

const { mergeClientsAction, previewClientMergeAction, searchClientsAction, updateClientAction } = await import("@/features/clients/actions")

describe("карточка клиента", () => {
  beforeEach(() => {
    updateCustomer.mockReset()
    customerMerge.mockReset()
    searchCustomers.mockReset()
  })

  it("правка контактов: телефон без пробелов, пустой e-mail очищает поле", async () => {
    updateCustomer.mockResolvedValue(undefined)
    const result = await updateClientAction("c-1", { name: " Свет ", phone: "+996 555 12-34-56", email: "" })
    expect(result.ok).toBe(true)
    expect(updateCustomer).toHaveBeenCalledWith({}, "c-1", { name: "Свет", phone: "+996555123456", email: "" })
  })

  it("неверный телефон не уходит на сервер", async () => {
    const result = await updateClientAction("c-1", { name: "Свет", phone: "555", email: "" })
    expect(result.ok).toBe(false)
    expect(updateCustomer).not.toHaveBeenCalled()
  })

  it("поиск дубля начинается с двух символов", async () => {
    expect(await searchClientsAction(" a ")).toEqual({ ok: true, data: [] })
    expect(searchCustomers).not.toHaveBeenCalled()
  })
})

describe("объединение дублей", () => {
  beforeEach(() => {
    customerMerge.mockReset()
  })

  it("предпросмотр ничего не меняет, подтверждение — объединяет", async () => {
    customerMerge.mockResolvedValue({ references: { deals: 2 }, fills: ["phone"] })
    await previewClientMergeAction("c-1", "c-2")
    expect(customerMerge).toHaveBeenLastCalledWith({}, "c-1", "c-2", false)
    const merged = await mergeClientsAction("c-1", "c-2")
    expect(customerMerge).toHaveBeenLastCalledWith({}, "c-1", "c-2", true)
    expect(merged).toEqual({ ok: true, data: { references: { deals: 2 }, fills: ["phone"] } })
  })

  it("менеджеру backend отказывает — показываем понятную причину", async () => {
    customerMerge.mockRejectedValue(new ApiError("forbidden", "Merging customers is for the director or a head of sales."))
    const result = await mergeClientsAction("c-1", "c-2")
    expect(!result.ok && result.message).toMatch(/директор или руководитель/)
  })
})
