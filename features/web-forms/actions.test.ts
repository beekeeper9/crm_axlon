import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const apiRequest = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}), getRenderAuth: async () => ({}) }))
vi.mock("@/config/env", () => ({ isMockDataSource: false }))

const { createWebFormKeyAction, revokeWebFormKeyAction } = await import("@/features/web-forms/actions")
const { buildEmbedSnippet, publicEndpointUrl, API_ADDRESS_PLACEHOLDER } = await import("@/features/web-forms/lib/snippet")

const key = {
  id: "k-1",
  name: "Сайт",
  departmentId: "d-1",
  departmentName: "Север",
  token: "t".repeat(32),
  endpointPath: `/api/v1/public/leads/${"t".repeat(32)}/`,
  isActive: true,
  createdBy: "u-1",
  createdByName: "РОП",
  createdAt: "2026-11-03T10:00:00+00:00",
  revokedAt: null,
  lastUsedAt: null,
  leadsCount: 0,
}

describe("ключи форм сайта", () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it("создание уходит в backend для отдела", async () => {
    apiRequest.mockResolvedValue(key)
    expect(await createWebFormKeyAction({ name: "  Сайт ", departmentId: "d-1" })).toEqual({ ok: true, key })
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/web-forms/keys/",
      expect.objectContaining({ method: "POST", body: { name: "Сайт", departmentId: "d-1" } })
    )
  })

  it("пустое название не отправляется", async () => {
    const result = await createWebFormKeyAction({ name: "   ", departmentId: "d-1" })
    expect(result.ok).toBe(false)
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("чужой отдел — понятный отказ, без ложного успеха", async () => {
    apiRequest.mockRejectedValue(new ApiError("forbidden", "own department only", { code: "access_denied" }))
    expect(await createWebFormKeyAction({ name: "Сайт", departmentId: "d-2" })).toEqual({
      ok: false,
      message: expect.stringMatching(/своего отдела/),
    })
  })

  it("отзыв ключа вызывает revoke", async () => {
    apiRequest.mockResolvedValue({ ...key, isActive: false, revokedAt: "2026-11-03T11:00:00+00:00" })
    const result = await revokeWebFormKeyAction("k-1")
    expect(result.ok).toBe(true)
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/web-forms/keys/k-1/revoke/", expect.objectContaining({ method: "POST" }))
  })

  it("ключ не найден — сообщение об ошибке", async () => {
    apiRequest.mockRejectedValue(new ApiError("not_found", "Key not found."))
    expect(await revokeWebFormKeyAction("k-x")).toEqual({ ok: false, message: expect.stringMatching(/не найден/) })
  })
})

describe("код формы для сайта", () => {
  it("содержит адрес отправки, ловушку для ботов и не содержит хоста по умолчанию", () => {
    const snippet = buildEmbedSnippet(key.endpointPath)
    expect(publicEndpointUrl(key.endpointPath)).toBe(`${API_ADDRESS_PLACEHOLDER}${key.endpointPath}`)
    expect(snippet).toContain(JSON.stringify(`${API_ADDRESS_PLACEHOLDER}${key.endpointPath}`))
    expect(snippet).toContain('name="website"')
    expect(snippet).toContain("utm_source")
    expect(snippet).not.toContain("localhost")
  })
})
