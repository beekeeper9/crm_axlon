import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { currencyCodeSchema, decimalStringSchema } from "@/lib/api/money"
import { PAGE_LIMIT_MAX, paginatedSchema } from "@/lib/api/pagination"

/**
 * Аналитика отделов продаж для директора и РОПа. Все числа считает backend:
 * лиды и клиенты — `/analytics/kpis/crm-counts/`, продажи, предоплаты и деньги —
 * `/payments/metrics/` (продажа — каждая сделка с первой оплатой), планы — `/plans/progress/`,
 * план-факт и день отдела — `/team/plan-fact/` и `/team/today/`. Область данных решает backend.
 */

const departmentSchema = z.object({ id: z.string(), name: z.string(), isActive: z.boolean() })
export type Department = z.infer<typeof departmentSchema>

export async function fetchDepartments(auth: ApiAuth): Promise<Department[]> {
  const page = await apiRequest("/api/v1/departments/", {
    auth,
    schema: z.union([paginatedSchema(departmentSchema), z.array(departmentSchema).transform((results) => ({ count: results.length, results }))]),
  })
  return page.results.filter((department) => department.isActive)
}

const companySchema = z.object({ currency: currencyCodeSchema })

/** Валюта компании по умолчанию (`GET /company/`) — предвыбор в форме денежного плана */
export async function fetchCompanyCurrency(auth: ApiAuth): Promise<string> {
  return (await apiRequest("/api/v1/company/", { auth, schema: companySchema })).currency
}

const crmCountsSchema = z.object({
  dateFrom: z.iso.date(),
  dateTo: z.iso.date(),
  results: z.array(
    z.object({
      groupId: z.string().nullable(),
      leadsTotal: z.int().nonnegative(),
      leadsNew: z.int().nonnegative(),
      customersTotal: z.int().nonnegative(),
      customersNew: z.int().nonnegative(),
    })
  ),
})

export type LeadCounts = { leadsTotal: number; leadsNew: number; customersTotal: number; customersNew: number }

/**
 * Лиды и клиенты: всего в базе и новые за период. groupBy=department — по отделам (ключ — id
 * отдела, null — записи без отдела), company — итог компании (ключ null). Сумм на frontend нет.
 */
export async function fetchLeadCounts(
  auth: ApiAuth,
  dateFrom: string,
  dateTo: string,
  groupBy: "department" | "company"
): Promise<Map<string | null, LeadCounts>> {
  const counts = await apiRequest("/api/v1/analytics/kpis/crm-counts/", {
    auth,
    query: { groupBy, dateFrom, dateTo },
    schema: crmCountsSchema,
  })
  return new Map(counts.results.map(({ groupId, ...row }) => [groupBy === "company" ? null : groupId, row]))
}

const salesMetricsSchema = z.object({
  salesCount: z.int().nonnegative(),
  newClients: z.int().nonnegative(),
  turnover: decimalStringSchema,
  received: decimalStringSchema,
  debt: decimalStringSchema,
  currency: currencyCodeSchema,
  /** Старый backend полей предоплат не отдаёт */
  prepaymentsCount: z.int().nonnegative().nullable().default(null),
  prepaymentsAmount: decimalStringSchema.nullable().default(null),
})

export type SalesMetrics = z.infer<typeof salesMetricsSchema>

/** Продажи, предоплаты и деньги за период; departmentId — только этот отдел */
export function fetchSalesMetrics(auth: ApiAuth, paidFrom: string, paidTo: string, departmentId: string | null): Promise<SalesMetrics> {
  return apiRequest("/api/v1/payments/metrics/", {
    auth,
    query: { paidFrom, paidTo, departmentId: departmentId ?? undefined },
    schema: salesMetricsSchema,
  })
}

const planProgressSchema = z.object({
  id: z.string(),
  scope: z.enum(["company", "department", "user"]),
  scopeId: z.string().nullable(),
  metric: z.string(),
  period: z.string(),
  target: decimalStringSchema,
  unit: z.enum(["count", "money"]),
  currency: z.string().nullable(),
  actual: decimalStringSchema.nullable(),
  percent: decimalStringSchema.nullable(),
  remaining: decimalStringSchema.nullable(),
})

export type PlanProgress = z.infer<typeof planProgressSchema>

/** Месячные планы (продажи и оборот) уровня компании и отделов за месяц ГГГГ-ММ */
export async function fetchMonthPlans(auth: ApiAuth, month: string): Promise<PlanProgress[]> {
  const page = await apiRequest("/api/v1/plans/progress/", {
    auth,
    query: { period: month, limit: PAGE_LIMIT_MAX },
    schema: paginatedSchema(planProgressSchema),
  })
  return page.results.filter((plan) => plan.scope !== "user" && (plan.metric === "monthly_sales" || plan.metric === "monthly_turnover"))
}

export function plansFor(plans: readonly PlanProgress[], scope: "company" | "department", scopeId: string | null): PlanProgress[] {
  return plans
    .filter((plan) => plan.scope === scope && (scope === "company" || plan.scopeId === scopeId))
    .toSorted((a, b) => (a.metric === "monthly_sales" ? -1 : 1) - (b.metric === "monthly_sales" ? -1 : 1))
}

const planFactSchema = z.object({
  month: z.string(),
  workingDaysTotal: z.int().nonnegative(),
  workingDaysElapsed: z.int().nonnegative(),
  planSalesTotal: decimalStringSchema,
  salesActualTotal: z.int().nonnegative(),
  receivedTotal: decimalStringSchema,
  forecastSalesTotal: decimalStringSchema,
  rows: z.array(
    z.object({
      userId: z.string(),
      username: z.string(),
      productRole: z.string(),
      planSales: decimalStringSchema,
      salesActual: z.int().nonnegative(),
      receivedActual: decimalStringSchema,
      remainingSales: decimalStringSchema,
      forecastSales: decimalStringSchema,
    })
  ),
})

export type DepartmentPlanFact = z.infer<typeof planFactSchema>

export function fetchDepartmentPlanFact(auth: ApiAuth, departmentId: string): Promise<DepartmentPlanFact> {
  return apiRequest("/api/v1/team/plan-fact/", { auth, query: { departmentId }, schema: planFactSchema })
}

const todaySchema = z.object({
  asOf: z.iso.datetime({ offset: true }),
  managers: z.array(
    z.object({
      userId: z.string(),
      username: z.string(),
      productRole: z.string(),
      meetingsTotal: z.int().nonnegative(),
      meetingsHeld: z.int().nonnegative(),
      meetingsOverdueOutcome: z.int().nonnegative(),
      calls: z.int().nonnegative(),
      paymentsCount: z.int().nonnegative(),
      overdueTasks: z.int().nonnegative(),
      onAbsence: z.boolean(),
      status: z.enum(["green", "yellow", "red"]),
      redReasons: z.array(z.string()),
      yellowReasons: z.array(z.string()),
    })
  ),
  totals: z.object({ red: z.int(), yellow: z.int(), green: z.int(), managers: z.int() }),
})

export type DepartmentToday = z.infer<typeof todaySchema>

export function fetchDepartmentToday(auth: ApiAuth, departmentId: string): Promise<DepartmentToday> {
  return apiRequest("/api/v1/team/today/", { auth, query: { departmentId }, schema: todaySchema })
}

const staffSchema = z.object({
  results: z.array(
    z.object({
      userId: z.string(),
      login: z.string(),
      fullName: z.string(),
      role: z.string(),
      status: z.string(),
      department: z.object({ id: z.string(), name: z.string() }).nullable(),
    })
  ),
})

export type StaffMember = { userId: string; name: string; role: string; departmentId: string | null; isActive: boolean }

/** Сотрудники в области пользователя (директор — компания, РОП — свой отдел) */
export async function fetchStaff(auth: ApiAuth): Promise<StaffMember[]> {
  const staff = await apiRequest("/api/v1/staff/", { auth, schema: staffSchema })
  return staff.results.map((member) => ({
    userId: member.userId,
    name: member.fullName || member.login,
    role: member.role,
    departmentId: member.department?.id ?? null,
    isActive: member.status !== "deactivated",
  }))
}
