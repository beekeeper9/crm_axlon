import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/client", () => ({ apiRequest: vi.fn() }))
vi.mock("@/lib/auth/token-store", () => ({ getRenderAuth: async () => ({}) }))

const { appHref, toInbox } = await import("@/features/notifications/api/notifications-repository")

describe("уведомления", () => {
  it("ссылка — только путь приложения, не адрес API и не внешний сайт", () => {
    expect(appHref("/leads/d-1")).toBe("/leads/d-1")
    expect(appHref("/api/v1/ai/risk/review/")).toBeNull()
    expect(appHref("https://evil.example")).toBeNull()
    expect(appHref("//evil.example")).toBeNull()
    expect(appHref(null)).toBeNull()
  })

  it("число непрочитанных — от backend, пустой текст — null", () => {
    const inbox = toInbox({
      count: 2,
      unread: 1,
      results: [
        { id: "n-1", category: "meeting", title: "Встреча через час", body: "", link: "/meetings", read: false, createdAt: "2026-11-02T10:00:00+06:00" },
      ],
    })
    expect(inbox.unread).toBe(1)
    expect(inbox.items[0]).toMatchObject({ body: null, href: "/meetings", isRead: false })
  })
})

describe("перевод текстов уведомлений", () => {
  it("известные события — по-русски, неизвестные — как есть", async () => {
    const { translate } = await import("@/features/notifications/api/notifications-repository")
    expect(translate("New deal")).toBe("Новая сделка")
    expect(translate("AI deal brief is ready")).toBe("Сводка ИИ по сделке: готово")
    expect(translate("Something else")).toBe("Something else")
  })
})
