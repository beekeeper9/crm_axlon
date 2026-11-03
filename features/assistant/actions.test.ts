import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const apiRequest = vi.fn()
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}) }))

const { askAssistantAction, decideAssistantAction } = await import("@/features/assistant/actions")

describe("ИИ-помощник", () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it("вопрос уходит на сервер, ответ не придумывается", async () => {
    apiRequest.mockResolvedValue({ id: "r-1", status: "pending", summary: null })
    const result = await askAssistantAction("  поставь задачу  ")
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/ai/agent/runs/", expect.objectContaining({ method: "POST", body: { request: "поставь задачу" } }))
    expect(result.ok && result.data.summary).toBeNull()
  })

  it("ИИ выключен на сервере — честное сообщение", async () => {
    apiRequest.mockImplementation(async () => {
      throw new ApiError("conflict", "AI features are not enabled", { code: "ai_disabled" })
    })
    const result = await askAssistantAction("сводка по сделке")
    expect(!result.ok && result.message).toMatch(/не включён/)
  })

  it("модуль вне тарифа — сообщение о тарифе", async () => {
    apiRequest.mockImplementation(async () => {
      throw new ApiError("forbidden", "not in plan", { code: "feature_not_in_plan" })
    })
    const result = await askAssistantAction("сводка по сделке")
    expect(!result.ok && result.message).toMatch(/тариф/)
  })

  it("действие подтверждается отдельным запросом", async () => {
    apiRequest.mockResolvedValue({ index: 0, tool: "create_task", status: "executed" })
    await decideAssistantAction("r-1", 0, "confirm")
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/ai/agent/runs/r-1/actions/0/confirm/", expect.objectContaining({ method: "POST" }))
  })

  it("слишком короткий вопрос не отправляется", async () => {
    const result = await askAssistantAction("а")
    expect(result.ok).toBe(false)
    expect(apiRequest).not.toHaveBeenCalled()
  })
})
