import { beforeEach, describe, expect, it, vi } from "vitest"

const apiRequest = vi.fn()
/** Как настоящий клиент: ответ проходит через схему запроса */
vi.mock("@/lib/api/client", () => ({
  apiRequest: async (path: string, options: { schema: { parse: (data: unknown) => unknown } }) =>
    options.schema.parse(await apiRequest(path, options)),
}))
vi.mock("@/lib/auth/token-store", () => ({ getRenderAuth: async () => ({}) }))
vi.mock("@/features/team", () => ({ loadPeopleNames: async () => (id: string) => (id === "u-1" ? "Айбек Садыков" : "Сотрудник") }))

const { fetchTodayActions } = await import("@/features/team-cabinet/api/today-actions")
const { groupByManager, todayGroupHref, todayItemHref, todayItemMeta } = await import("@/features/team-cabinet/lib/today-actions")

const group = (kind: string, priority: number, extra: Record<string, unknown> = {}) => ({
  kind,
  priority,
  title: kind,
  rule: "Правило",
  count: 0,
  amounts: [],
  byManager: [],
  items: [],
  ...extra,
})

const response = {
  asOf: "2026-11-03T10:00:00+06:00",
  managers: [],
  actions: {
    date: "2026-11-03",
    asOf: "2026-11-03T10:00:00+06:00",
    limit: 5,
    departmentId: null,
    thresholds: { stalledDealDays: 14, leadResponseMinutes: 15 },
    total: 3,
    groups: [
      group("deals_to_push", 6, {
        count: 1,
        amounts: [{ currency: "KGS", total: "700.00" }],
        byManager: [{ userId: "u-2", username: "rep2", count: 1 }],
        items: [
          {
            id: "d-1",
            title: "Дожим",
            managerId: "u-2",
            managerUsername: "rep2",
            amount: "1000.00",
            currency: "KGS",
            date: null,
            at: null,
            ageDays: 20,
            subjectType: "deal",
            subjectId: "d-1",
            reasons: ["prepayment", "debt"],
            paid: "300.00",
            debt: "700.00",
            stageName: "Думает",
          },
        ],
      }),
      group("payments_to_verify", 1, {
        count: 2,
        amounts: [
          { currency: "KGS", total: "1000.00" },
          { currency: "USD", total: "50.00" },
        ],
        items: [{ id: "p-1", title: "", managerId: "u-1", amount: "1000.00", currency: "KGS", ageDays: 0, subjectType: "deal", subjectId: "d-1" }],
      }),
      group("brand_new_rule", 9),
    ],
  },
}

describe("«Что делать сегодня»: ответ backend", () => {
  beforeEach(() => apiRequest.mockReset())

  it("просит группы у /team/today/ и раскладывает их по приоритету с именами менеджеров", async () => {
    apiRequest.mockResolvedValueOnce(response)
    const actions = await fetchTodayActions("dep-1")

    const [path, options] = apiRequest.mock.calls[0] as [string, { query: Record<string, unknown> }]
    expect(path).toBe("/api/v1/team/today/")
    expect(options.query).toMatchObject({ include: "actions", actionsLimit: 5, departmentId: "dep-1" })

    expect(actions.groups.map((g) => g.kind)).toEqual(["payments_to_verify", "deals_to_push", "brand_new_rule"])
    const payments = actions.groups[0]!
    // Суммы по валютам не складываются
    expect(payments.amounts).toEqual([
      { currency: "KGS", total: "1000.00" },
      { currency: "USD", total: "50.00" },
    ])
    expect(payments.items[0]!.managerName).toBe("Айбек Садыков")
    expect(payments.items[0]!.reasons).toEqual([])
    const push = actions.groups[1]!
    // Имени нет в справочнике — показываем логин
    expect(push.items[0]!.managerName).toBe("rep2")
    expect(push.byManager).toEqual([{ userId: "u-2", name: "rep2", count: 1 }])
  })

  it("не принимает ответ без блока действий", async () => {
    apiRequest.mockResolvedValueOnce({ asOf: "2026-11-03T10:00:00+06:00", managers: [] })
    await expect(fetchTodayActions()).rejects.toThrow()
  })

  it("ведёт на карточку или экран, где действие выполняется", async () => {
    apiRequest.mockResolvedValueOnce(response)
    const actions = await fetchTodayActions()
    const [payments, push, unknown] = actions.groups
    expect(todayGroupHref("payments_to_verify")).toBe("/payments/review")
    expect(todayItemHref("payments_to_verify", payments!.items[0]!)).toBe("/payments/review")
    expect(todayItemHref("deals_to_push", push!.items[0]!)).toBe("/leads/d-1")
    expect(todayGroupHref(unknown!.kind)).toBeNull()
    expect(todayItemHref("leads_without_contact", { ...push!.items[0]!, id: "l-1" })).toBe("/prospects/l-1")
    expect(todayItemHref("managers_without_activity", { ...push!.items[0]!, id: "u-9" })).toBe("/team/u-9")
    expect(todayItemHref("overdue_tasks", { ...push!.items[0]!, subjectType: "customer", managerId: "u-1" })).toBe("/tasks?assignee=u-1&due=overdue")
    expect(todayItemMeta("deals_to_push", push!.items[0]!, actions.date)).toEqual(
      expect.arrayContaining(["на этапе 20 дней", "есть предоплата", expect.stringContaining("долг 700")])
    )
    expect(todayItemMeta("tasks_due_soon", { ...push!.items[0]!, date: "2026-11-03" }, actions.date)).toEqual(["срок сегодня"])
  })
})

describe("groupByManager", () => {
  const item = (id: string, managerId: string | null, managerName: string | null) =>
    ({ id, title: id, managerId, managerName }) as unknown as import("@/features/team-cabinet/api/today-actions").TodayActionItem
  const g = (kind: string, items: ReturnType<typeof item>[]) =>
    ({ kind, priority: 1, title: kind, rule: "", count: items.length, amounts: [], byManager: [], items }) as import("@/features/team-cabinet/api/today-actions").TodayActionGroup

  it("раскладывает строки групп по менеджерам: у кого больше дел — выше", () => {
    const blocks = groupByManager([
      g("deals_without_next_step", [item("d1", "u-1", "Айбек"), item("d2", "u-2", "Алиса")]),
      g("leads_without_contact", [item("l1", "u-2", "Алиса"), item("l2", null, null)]),
    ])
    expect(blocks.map((b) => [b.name, b.total])).toEqual([
      ["Алиса", 2],
      ["Айбек", 1],
      ["Без ответственного", 1],
    ])
    expect(blocks[0].groups.map((entry) => [entry.group.kind, entry.items.map((i) => i.id)])).toEqual([
      ["deals_without_next_step", ["d2"]],
      ["leads_without_contact", ["l1"]],
    ])
  })
})
