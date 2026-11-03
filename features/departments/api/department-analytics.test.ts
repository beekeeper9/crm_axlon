import { beforeEach, describe, expect, it, vi } from "vitest"

const apiRequest = vi.fn()
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))

const { fetchLeadCounts, fetchMonthPlans, fetchSalesMetrics, fetchStaff, plansFor } = await import(
  "@/features/departments/api/department-analytics"
)

const auth = { tokens: { read: async () => null, write: async () => {}, clear: async () => {} } }

const plan = (overrides: Record<string, unknown>) => ({
  id: "p",
  scope: "department",
  scopeId: "d-1",
  metric: "monthly_sales",
  period: "2026-11",
  target: "10.00",
  unit: "count",
  currency: null,
  actual: "4",
  percent: "40.0",
  remaining: "6.00",
  ...overrides,
})

describe("аналитика отделов", () => {
  beforeEach(() => apiRequest.mockReset())

  it("лиды по отделам и итог компании — ключи групп backend, без сумм на frontend", async () => {
    apiRequest.mockImplementation(async (...args: unknown[]) => {
      if (args.length < 2) return undefined
      const { query, schema } = args[1] as { query: { groupBy: string }; schema: { parse: (v: unknown) => unknown } }
      return schema.parse(
        query.groupBy === "company"
          ? { dateFrom: "2026-11-01", dateTo: "2026-11-03", results: [{ groupId: null, leadsTotal: 9, leadsNew: 2, customersTotal: 5, customersNew: 1 }] }
          : {
              dateFrom: "2026-11-01",
              dateTo: "2026-11-03",
              results: [
                { groupId: "d-1", leadsTotal: 7, leadsNew: 2, customersTotal: 3, customersNew: 1 },
                { groupId: null, leadsTotal: 2, leadsNew: 0, customersTotal: 2, customersNew: 0 },
              ],
            }
      )
    })
    const byDepartment = await fetchLeadCounts(auth, "2026-11-01", "2026-11-03", "department")
    expect(byDepartment.get("d-1")?.leadsTotal).toBe(7)
    const company = await fetchLeadCounts(auth, "2026-11-01", "2026-11-03", "company")
    expect(company.get(null)?.leadsTotal).toBe(9)
    expect(apiRequest).toHaveBeenLastCalledWith(
      "/api/v1/analytics/kpis/crm-counts/",
      expect.objectContaining({ query: { groupBy: "company", dateFrom: "2026-11-01", dateTo: "2026-11-03" } })
    )
  })

  it("метрики отдела: фильтр отдела уходит в backend; без полей предоплат — «нет данных», а не ноль", async () => {
    apiRequest.mockImplementation(async (...args: unknown[]) =>
      (args[1] as { schema: { parse: (v: unknown) => unknown } } | undefined)?.schema.parse({
        salesCount: 2,
        newClients: 1,
        turnover: "500.00",
        received: "300.00",
        debt: "200.00",
        currency: "KGS",
      })
    )
    const metrics = await fetchSalesMetrics(auth, "2026-11-01", "2026-11-03", "d-1")
    expect(metrics.prepaymentsCount).toBeNull()
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/payments/metrics/",
      expect.objectContaining({ query: { paidFrom: "2026-11-01", paidTo: "2026-11-03", departmentId: "d-1" } })
    )
  })

  it("планы месяца: только компания и отделы, продажи раньше оборота", async () => {
    apiRequest.mockResolvedValue({
      count: 3,
      results: [
        plan({ id: "turnover", metric: "monthly_turnover", unit: "money", currency: "KGS" }),
        plan({ id: "sales" }),
        plan({ id: "user", scope: "user", scopeId: "u-1" }),
        plan({ id: "company", scope: "company", scopeId: null }),
      ],
    })
    const plans = await fetchMonthPlans(auth, "2026-11")
    expect(plans.map((item) => item.id)).not.toContain("user")
    expect(plansFor(plans, "department", "d-1").map((item) => item.id)).toEqual(["sales", "turnover"])
    expect(plansFor(plans, "company", null).map((item) => item.id)).toEqual(["company"])
  })

  it("сотрудники: имя или логин, отдел и активность", async () => {
    apiRequest.mockResolvedValue({
      results: [
        { userId: "u-1", login: "alina", fullName: "Алина Ким", role: "head_of_sales", status: "active", department: { id: "d-1", name: "ОП" } },
        { userId: "u-2", login: "old", fullName: "", role: "sales_rep", status: "deactivated", department: null },
      ],
    })
    expect(await fetchStaff(auth)).toEqual([
      { userId: "u-1", name: "Алина Ким", role: "head_of_sales", departmentId: "d-1", isActive: true },
      { userId: "u-2", name: "old", role: "sales_rep", departmentId: null, isActive: false },
    ])
  })
})
