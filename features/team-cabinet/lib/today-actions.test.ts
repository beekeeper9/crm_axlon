import { describe, expect, it } from "vitest"

import type { TodayActionItem } from "@/features/team-cabinet/api/today-actions"
import { todayItemHref, todayItemMeta } from "@/features/team-cabinet/lib/today-actions"

const item = (patch: Partial<TodayActionItem>): TodayActionItem => ({
  id: "d-1",
  title: "Болгария: долг",
  managerId: "u-1",
  managerUsername: "rep",
  managerName: "Алиса",
  amount: null,
  currency: null,
  date: null,
  at: null,
  ageDays: null,
  subjectType: null,
  subjectId: null,
  reasons: [],
  paid: null,
  debt: null,
  stageName: null,
  ...patch,
})

describe("группы «Фокуса» менеджера", () => {
  it("долг к сбору: сколько осталось, сколько оплачено и этап; ссылка — на сделку", () => {
    const debt = item({ amount: "1000.00", currency: "KGS", paid: "400.00", debt: "600.00", stageName: "Продажа" })
    const meta = todayItemMeta("debts_to_collect", debt, "2026-11-05")
    expect(meta).toHaveLength(3)
    expect(meta[0]).toMatch(/^долг 600/)
    expect(meta[1]).toMatch(/^оплачено 400.* из 1/)
    expect(meta[2]).toBe("Продажа")
    expect(todayItemHref("debts_to_collect", debt)).toBe("/leads/d-1")
  })

  it("задача по проколу: просрочка или срок; без сделки — в список задач исполнителя", () => {
    expect(todayItemMeta("miss_tasks", item({ ageDays: 2, date: "2026-11-03" }), "2026-11-05")).toEqual(["просрочена на 2 дня"])
    expect(todayItemMeta("miss_tasks", item({ date: "2026-11-05" }), "2026-11-05")).toEqual(["срок сегодня"])
    expect(todayItemHref("miss_tasks", item({}))).toBe("/tasks?assignee=u-1")
    expect(todayItemHref("miss_tasks", item({ subjectType: "deal", subjectId: "d-9" }))).toBe("/leads/d-9")
  })
})
