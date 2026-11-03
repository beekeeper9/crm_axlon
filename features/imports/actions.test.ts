import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const apiRequest = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}) }))

const { commitImportAction, previewImportAction } = await import("@/features/imports/actions")

const request = { entity: "leads", filename: "leads.csv", content: "Имя;Телефон\nАйбек;+996555123456\n", ownerUserId: null }

describe("загрузка из файла", () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it("ответственный уходит только если выбран другой сотрудник", async () => {
    apiRequest.mockResolvedValue({})
    await previewImportAction(request)
    expect(apiRequest.mock.calls[0]?.[1].body).toEqual({ entity: "leads", filename: "leads.csv", content: request.content })
    await commitImportAction({ ...request, ownerUserId: "u-7" })
    expect(apiRequest.mock.calls[1]?.[0]).toBe("/api/v1/imports/")
    expect(apiRequest.mock.calls[1]?.[1].body).toMatchObject({ ownerUserId: "u-7" })
  })

  it("ошибку разбора файла backend пишет по-русски — показываем её", async () => {
    apiRequest.mockRejectedValue(new ApiError("validation", "Нет колонки с именем", { status: 400 }))
    expect(await previewImportAction(request)).toEqual({ ok: false, message: "Нет колонки с именем" })
  })

  it("пустой файл не отправляется", async () => {
    expect(await previewImportAction({ ...request, content: "" })).toEqual({ ok: false, message: "Файл пустой" })
    expect(apiRequest).not.toHaveBeenCalled()
  })
})
