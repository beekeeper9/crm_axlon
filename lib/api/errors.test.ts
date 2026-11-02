import { describe, expect, it } from "vitest"

import { API_ERROR_MESSAGES, ApiError, apiErrorMessage } from "@/lib/api/errors"

describe("apiErrorMessage", () => {
  it("модуль вне тарифа — сообщение про тариф, а не общее «нет доступа»", () => {
    const error = new ApiError("forbidden", "Feature not in plan", { code: "feature_not_in_plan" })
    expect(apiErrorMessage(error)).toMatch(/тариф/)
  })

  it("неактивная подписка — своё сообщение", () => {
    const error = new ApiError("forbidden", "inactive", { code: "subscription_inactive" })
    expect(apiErrorMessage(error)).toMatch(/Подписка/)
  })

  it("без известного кода — сообщение по виду ошибки", () => {
    expect(apiErrorMessage(new ApiError("server", "boom"))).toBe(API_ERROR_MESSAGES.server)
  })
})
