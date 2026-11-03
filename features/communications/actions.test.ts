import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const apiRequest = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}) }))

const { createTemplateAction, deleteTemplateAction, updateTemplateAction } = await import("@/features/communications/actions")

describe("шаблоны сообщений", () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it("пустое название не уходит на backend", async () => {
    expect(await createTemplateAction({ title: "  ", body: "Здравствуйте" })).toBe("Введите название")
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("правка уходит PATCH с обрезанными пробелами", async () => {
    apiRequest.mockResolvedValue({})
    expect(await updateTemplateAction("t-1", { title: " Цена ", body: "Стоимость — 5000 сом" })).toBeNull()
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/communications/templates/t-1/", expect.objectContaining({ method: "PATCH", body: { title: "Цена", body: "Стоимость — 5000 сом" } }))
  })

  it("менеджеру backend отказывает — объясняем, кто меняет шаблоны", async () => {
    apiRequest.mockRejectedValue(new ApiError("forbidden", "denied", { status: 403 }))
    expect(await deleteTemplateAction("t-1")).toMatch(/директор и РОП/)
  })
})
