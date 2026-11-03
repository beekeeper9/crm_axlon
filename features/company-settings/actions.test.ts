import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const apiRequest = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}) }))
const role = { current: "director" }
vi.mock("@/lib/session/current-user", () => ({ getCurrentUser: async () => ({ role: role.current }) }))

const { updateCompanySettingsAction } = await import("@/features/company-settings/actions")

const VALID = { name: " Axlon ", country: "KG", currency: "KGS", timezone: "Asia/Bishkek" }

describe("настройки компании", () => {
  beforeEach(() => {
    apiRequest.mockReset()
    role.current = "director"
  })

  it("директор сохраняет: PATCH /company/ с очищенным названием", async () => {
    apiRequest.mockResolvedValue({})
    expect(await updateCompanySettingsAction(VALID)).toBeNull()
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/company/", expect.objectContaining({ method: "PATCH", body: { ...VALID, name: "Axlon" } }))
  })

  it("РОП не меняет настройки, запрос не уходит", async () => {
    role.current = "head_of_sales"
    expect((await updateCompanySettingsAction(VALID))?.message).toMatch(/директор/)
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("уходят только переданные поля", async () => {
    apiRequest.mockResolvedValue({})
    expect(await updateCompanySettingsAction({ timezone: "Asia/Almaty" })).toBeNull()
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/company/", expect.objectContaining({ body: { timezone: "Asia/Almaty" } }))
  })

  it("пустое название и неверная валюта — ошибки полей без запроса", async () => {
    const result = await updateCompanySettingsAction({ ...VALID, name: "  ", currency: "сом" })
    expect(result?.fieldErrors).toEqual({ name: "Укажите название компании", currency: "Выберите валюту" })
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("отказ backend по часовому поясу объясняется у поля", async () => {
    apiRequest.mockRejectedValueOnce(new ApiError("validation", "timezone must be an IANA name, e.g. Asia/Bishkek."))
    const result = await updateCompanySettingsAction({ ...VALID, timezone: "Mars/Olympus" })
    expect(result?.fieldErrors).toEqual({ timezone: "Выберите часовой пояс из списка." })
  })
})
