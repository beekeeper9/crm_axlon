import { describe, expect, it } from "vitest"

import type { Conversation, Message } from "@/features/communications/api/communications-repository"
import { chatErrorMessage, chatHref, chatTimeLabel, chatTitle, filterChats, messageAuthor, messageProblem } from "@/features/chats/lib/chat-list"
import { ApiError } from "@/lib/api/errors"
import { formatDayMonth, formatTime } from "@/lib/format"

function chat(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    channel: "whatsapp",
    externalContactId: "+996555000111",
    contactName: "Айгуль",
    status: "open",
    customerId: null,
    leadId: null,
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
  it("ведёт к лиду, затем к клиенту; непривязанный чат не открывается", () => {
    expect(chatHref(chat())).toBeNull()
    expect(chatHref(chat({ customerId: "x1" }))).toBe("/client-base?client=x1")
    expect(chatHref(chat({ customerId: "x1", leadId: "l1" }))).toBe("/leads/l1")
  })
})

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "m1",
    direction: "outbound",
    text: "Здравствуйте",
    status: "sent",
    senderUserId: "u1",
    failureCode: null,
    createdAt: "2026-11-06T08:30:00Z",
    ...overrides,
  }
}

describe("messageAuthor", () => {
  it("отличает клиента, ответ из CRM и ответ с телефона", () => {
    expect(messageAuthor(message({ direction: "inbound", senderUserId: null }))).toBe("Клиент")
    expect(messageAuthor(message())).toBe("Компания")
    expect(messageAuthor(message({ senderUserId: null }))).toBe("С телефона")
  })
})

describe("messageProblem", () => {
  it("называет закрытое окно 24 часов отдельно от прочих сбоев", () => {
    expect(messageProblem(message())).toBeNull()
    expect(messageProblem(message({ status: "failed" }))).toBe("Не доставлено")
    expect(messageProblem(message({ status: "failed", failureCode: "131047" }))).toContain("24 часов")
  })
})

describe("chatErrorMessage", () => {
  it("объясняет отказы канала и прав", () => {
    expect(chatErrorMessage(new ApiError("conflict", "x", { code: "channel_not_configured" }))).toBe("WhatsApp не подключён.")
    expect(chatErrorMessage(new ApiError("conflict", "x", { code: "conversation_invalid_state" }))).toContain("Чат закрыт")
    expect(chatErrorMessage(new ApiError("forbidden", "x"))).toBe("Нет прав на этот чат.")
    expect(chatErrorMessage(new ApiError("forbidden", "x", { code: "feature_not_in_plan" }))).toContain("тариф")
  })
})
