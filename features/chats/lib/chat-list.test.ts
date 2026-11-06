import { describe, expect, it } from "vitest"

import type { Conversation } from "@/features/communications/api/communications-repository"
import { chatHref, chatTimeLabel, chatTitle, filterChats } from "@/features/chats/lib/chat-list"
import { formatDayMonth, formatTime } from "@/lib/format"

function chat(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    channel: "whatsapp",
    externalContactId: "+996555000111",
    contactName: "Айгуль",
    status: "open",
    customerId: null,
    ownerUserId: null,
    unreadCount: 0,
    lastMessageAt: null,
    ...overrides,
  }
}

describe("chatTitle", () => {
  it("показывает номер, если имени нет", () => {
    expect(chatTitle(chat())).toBe("Айгуль")
    expect(chatTitle(chat({ contactName: null }))).toBe("+996555000111")
  })
})

describe("chatTimeLabel", () => {
  const now = new Date("2026-11-06T09:00:00Z")

  it("сегодня — время, раньше — дата, без сообщений — ничего", () => {
    expect(chatTimeLabel("2026-11-06T08:30:00Z", now)).toBe(formatTime("2026-11-06T08:30:00Z"))
    expect(chatTimeLabel("2026-10-01T08:30:00Z", now)).toBe(formatDayMonth("2026-10-01T08:30:00Z"))
    expect(chatTimeLabel(null, now)).toBeNull()
  })
})

describe("filterChats", () => {
  const chats = [chat({ id: "a" }), chat({ id: "b", contactName: null })]

  it("ищет по имени и номеру без учёта регистра", () => {
    expect(filterChats(chats, "  айг ").map((item) => item.id)).toEqual(["a"])
    expect(filterChats(chats, "555").map((item) => item.id)).toEqual(["b"])
    expect(filterChats(chats, "")).toHaveLength(2)
  })
})

describe("chatHref", () => {
  it("ведёт в карточку только привязанный чат", () => {
    expect(chatHref(chat())).toBeNull()
    expect(chatHref(chat({ customerId: "x1" }))).toBe("/client-base?client=x1")
  })
})
