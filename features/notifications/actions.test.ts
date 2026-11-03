import { beforeEach, describe, expect, it, vi } from "vitest"

const apiRequest = vi.fn()
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}), getRenderAuth: async () => ({}) }))

const { savePreferenceAction } = await import("@/features/notifications/actions")
const { fetchPreferences } = await import("@/features/notifications/api/notifications-repository")

describe("настройки уведомлений", () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it("срок напоминания уходит на backend и возвращаются его настройки", async () => {
    apiRequest.mockResolvedValue({ categories: { task: true, meeting: false }, reminderDaysBefore: 3 })
    const result = await savePreferenceAction({ reminderDaysBefore: 3 })
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/notifications/preferences/",
      expect.objectContaining({ method: "POST", body: { reminderDaysBefore: 3 } })
    )
    expect(result).toEqual({ ok: true, preferences: { categories: { task: true, meeting: false }, reminderDaysBefore: 3 } })
  })

  it("недопустимый срок не отправляется", async () => {
    const result = await savePreferenceAction({ reminderDaysBefore: 9 })
    expect(result.ok).toBe(false)
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("неизвестные категории backend отбрасываются, а не ломают страницу", async () => {
    apiRequest.mockResolvedValue({ categories: { task: false, future_kind: true }, reminderDaysBefore: 1 })
    expect(await fetchPreferences()).toEqual({ categories: { task: false }, reminderDaysBefore: 1 })
  })
})
