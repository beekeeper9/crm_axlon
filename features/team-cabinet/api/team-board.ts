import { z } from "zod"

import { loadPeopleNames } from "@/features/team"
import { ABSENCE_KINDS, PLAN_METRICS } from "@/features/team-cabinet/lib/plan-absence-meta"
import { apiRequest } from "@/lib/api/client"
import { decimalStringSchema } from "@/lib/api/money"
import { PAGE_LIMIT_MAX, paginatedSchema } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { nowIso } from "@/lib/clock"
import { companyDateOf } from "@/lib/datetime"

/**
 * Кабинет РОПа через backend: `GET /team/today/` и `GET /team/plan-fact/`.
 * Формат ответа уже, чем макет кабинета из ТЗ, поэтому у него свои схемы: недостающие
 * показатели не подставляются нулями. Отдел РОПа и права решает backend.
 */

const levelSchema = z.enum(["green", "yellow", "red"])

const managerDaySchema = z.object({
  userId: z.string(),
  username: z.string(),
  calls: z.int().nonnegative(),
  meetingsTotal: z.int().nonnegative(),
  meetingsConfirmed: z.int().nonnegative(),
  meetingsHeld: z.int().nonnegative(),
  meetingsNoShow: z.int().nonnegative(),
  meetingsOverdueOutcome: z.int().nonnegative(),
  paymentsCount: z.int().nonnegative(),
  received: decimalStringSchema,
  openTasks: z.int().nonnegative(),
  overdueTasks: z.int().nonnegative(),
  onAbsence: z.boolean(),
  status: levelSchema,
  redReasons: z.array(z.string()),
  yellowReasons: z.array(z.string()),
})

const teamBoardSchema = z.object({
  asOf: z.iso.datetime({ offset: true }),
  managers: z.array(managerDaySchema),
  totals: z.object({
    managers: z.int().nonnegative(),
    calls: z.int().nonnegative(),
    meetingsTotal: z.int().nonnegative(),
    meetingsHeld: z.int().nonnegative(),
    paymentsCount: z.int().nonnegative(),
    received: decimalStringSchema,
    red: z.int().nonnegative(),
    yellow: z.int().nonnegative(),
    green: z.int().nonnegative(),
  }),
})

const planFactRowSchema = z.object({
  userId: z.string(),
  username: z.string(),
  planSales: decimalStringSchema,
  salesActual: z.int().nonnegative(),
  receivedActual: decimalStringSchema,
  remainingSales: decimalStringSchema,
  forecastSales: decimalStringSchema,
})

const planFactSchema = z.object({
  month: z.string(),
  workingDaysTotal: z.int().nonnegative(),
  workingDaysElapsed: z.int().nonnegative(),
  planSalesTotal: decimalStringSchema,
  salesActualTotal: z.int().nonnegative(),
  receivedTotal: decimalStringSchema,
  forecastSalesTotal: decimalStringSchema,
  rows: z.array(planFactRowSchema),
})

type Named<T> = T & { name: string }

export type TeamBoard = Omit<z.infer<typeof teamBoardSchema>, "managers"> & {
  managers: Named<z.infer<typeof managerDaySchema>>[]
}
export type TeamPlanFact = Omit<z.infer<typeof planFactSchema>, "rows"> & { rows: Named<z.infer<typeof planFactRowSchema>>[] }

/** Имя сотрудника из справочника; логин — если имени не видно */
async function namer(): Promise<(row: { userId: string; username: string }) => string> {
  const nameOf = await loadPeopleNames()
  return ({ userId, username }) => {
    const name = nameOf(userId)
    return name === "Сотрудник" ? username : name
  }
}

export async function fetchTeamBoard(): Promise<TeamBoard> {
  const [board, nameOf] = await Promise.all([
    apiRequest("/api/v1/team/today/", { auth: await getRenderAuth(), schema: teamBoardSchema }),
    namer(),
  ])
  return { ...board, managers: board.managers.map((row) => ({ ...row, name: nameOf(row) })) }
}

/** Текущий месяц компании (его выбирает backend) */
export async function fetchTeamPlanFact(): Promise<TeamPlanFact> {
  const [planFact, nameOf] = await Promise.all([
    apiRequest("/api/v1/team/plan-fact/", { auth: await getRenderAuth(), schema: planFactSchema }),
    namer(),
  ])
  return { ...planFact, rows: planFact.rows.map((row) => ({ ...row, name: nameOf(row) })) }
}

/** `GET /team/inactivity/` — сотрудники без звонков, встреч и оплат сегодня и не в плановом отсутствии */
export async function fetchInactivity(): Promise<TeamBoard> {
  const [board, nameOf] = await Promise.all([
    apiRequest("/api/v1/team/inactivity/", { auth: await getRenderAuth(), schema: teamBoardSchema }),
    namer(),
  ])
  return { ...board, managers: board.managers.map((row) => ({ ...row, name: nameOf(row) })) }
}

const absenceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  kind: z.enum(ABSENCE_KINDS),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  comment: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
})

export type Absence = z.infer<typeof absenceSchema> & { name: string }

/**
 * `GET /absences/?active_from&active_to` — отсутствия с начала текущего месяца и на daysAhead
 * дней вперёд (дни компании; нужно право absences.manage)
 */
export async function fetchAbsences(daysAhead: number): Promise<Absence[]> {
  const activeFrom = `${companyDateOf(nowIso()).slice(0, 7)}-01`
  const activeTo = companyDateOf(new Date(Date.parse(nowIso()) + daysAhead * 86_400_000).toISOString())
  const [page, nameOf] = await Promise.all([
    apiRequest("/api/v1/absences/", {
      auth: await getRenderAuth(),
      query: { activeFrom, activeTo, limit: PAGE_LIMIT_MAX },
      schema: paginatedSchema(absenceSchema),
    }),
    loadPeopleNames(),
  ])
  return page.results.map((absence) => ({ ...absence, name: nameOf(absence.userId) }))
}

const planProgressSchema = z.object({
  id: z.string(),
  scope: z.enum(["company", "department", "user"]),
  scopeId: z.string().nullable(),
  metric: z.enum(PLAN_METRICS),
  period: z.string(),
  target: decimalStringSchema,
  unit: z.enum(["count", "money"]),
  currency: z.string().nullable(),
  actual: decimalStringSchema.nullable(),
  percent: decimalStringSchema.nullable(),
  remaining: decimalStringSchema.nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
})

export type PlanProgressRow = z.infer<typeof planProgressSchema> & { scopeName: string }

/** `GET /plans/progress/?period` — видимые планы с фактом (факт и процент считает backend) */
export async function fetchPlansProgress(period: string, departments: ReadonlyMap<string, string>): Promise<PlanProgressRow[]> {
  const [page, nameOf] = await Promise.all([
    apiRequest("/api/v1/plans/progress/", {
      auth: await getRenderAuth(),
      query: { period, limit: PAGE_LIMIT_MAX },
      schema: paginatedSchema(planProgressSchema),
    }),
    loadPeopleNames(),
  ])
  return page.results.map((plan) => ({
    ...plan,
    scopeName:
      plan.scope === "company" ? "Компания" : plan.scope === "department" ? (departments.get(plan.scopeId ?? "") ?? "Отдел") : nameOf(plan.scopeId ?? ""),
  }))
}

const planChangeSchema = z.object({
  id: z.string(),
  authorUserId: z.string(),
  oldTarget: decimalStringSchema.nullable(),
  newTarget: decimalStringSchema,
  createdAt: z.iso.datetime({ offset: true }),
})

export type PlanChange = z.infer<typeof planChangeSchema> & { author: string }

/** `GET /plans/{id}/history/` — изменения цели, от старых к новым */
export async function fetchPlanHistory(planId: string): Promise<PlanChange[]> {
  const [history, nameOf] = await Promise.all([
    apiRequest(`/api/v1/plans/${encodeURIComponent(planId)}/history/`, {
      auth: await getRenderAuth(),
      schema: z.union([z.array(planChangeSchema), paginatedSchema(planChangeSchema).transform((page) => page.results)]),
    }),
    loadPeopleNames(),
  ])
  return history.map((change) => ({ ...change, author: nameOf(change.authorUserId) }))
}

const departmentSchema = z.object({ id: z.string(), name: z.string() })

/** Отделы в области пользователя — для подписей планов отдела и выбора в форме */
export async function fetchDepartments(): Promise<{ id: string; name: string }[]> {
  return apiRequest("/api/v1/departments/", {
    auth: await getRenderAuth(),
    schema: z.union([z.array(departmentSchema), paginatedSchema(departmentSchema).transform((page) => page.results)]),
  })
}
