import { z } from "zod"

import type { SetupFacts } from "@/features/company-settings/lib/setup-checklist"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { currencyCodeSchema } from "@/lib/api/money"
import { PAGE_LIMIT_MAX, paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"
import { backendRoleSchema } from "@/lib/permissions/backend-roles"

/**
 * Настройки компании (`GET/PATCH /company/`), данные для чек-листа запуска и журнал изменений
 * (`GET /audit/`). Работает только с backend: права и область журнала проверяет сервер.
 */

const companySettingsSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  country: z.string(),
  currency: currencyCodeSchema,
  timezone: z.string(),
})

export type CompanySettings = z.infer<typeof companySettingsSchema>

export type CompanySettingsPatch = Partial<Pick<CompanySettings, "name" | "country" | "currency" | "timezone">>

export function fetchCompanySettings(auth: ApiAuth): Promise<CompanySettings> {
  return apiRequest("/api/v1/company/", { auth, schema: companySettingsSchema })
}

export function updateCompanySettings(auth: ApiAuth, patch: CompanySettingsPatch): Promise<CompanySettings> {
  return apiRequest("/api/v1/company/", { method: "PATCH", auth, body: patch, schema: companySettingsSchema })
}

const departmentSchema = z.object({ id: z.string(), isActive: z.boolean() })
const staffSchema = z.object({
  role: backendRoleSchema,
  status: z.enum(["active", "invited", "deactivated"]),
  department: z.object({ id: z.string() }).nullable(),
})
const planSchema = z.object({ scope: z.enum(["company", "department", "user"]) })

/** Факты для чек-листа: отделы, сотрудники и планы компании за месяц ГГГГ-ММ */
export async function fetchSetupFacts(auth: ApiAuth, month: string): Promise<SetupFacts> {
  const [departments, staff, plans] = await Promise.all([
    apiRequest("/api/v1/departments/", {
      auth,
      schema: z.union([paginatedSchema(departmentSchema), z.array(departmentSchema).transform((results) => ({ results }))]),
    }),
    apiRequest("/api/v1/staff/", { auth, schema: paginatedSchema(staffSchema) }),
    apiRequest("/api/v1/plans/progress/", { auth, query: { period: month, limit: PAGE_LIMIT_MAX }, schema: paginatedSchema(planSchema) }),
  ])
  return {
    departments: departments.results.filter((department) => department.isActive),
    staff: staff.results.map((member) => ({ role: member.role, status: member.status, departmentId: member.department?.id ?? null })),
    hasCompanyPlan: plans.results.some((plan) => plan.scope === "company"),
  }
}

const journalEntrySchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  actor: z.object({ id: z.string(), name: z.string() }).nullable(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  changedFields: z.array(z.string()),
  details: z.record(z.string(), z.unknown()),
})

export type JournalEntry = z.infer<typeof journalEntrySchema>

export type JournalFilters = {
  actorId: string | null
  /** Префикс действия с точкой (`deal.`) или точное действие */
  action: string | null
  dateFrom: string | null
  dateTo: string | null
}

export function fetchAuditJournal(auth: ApiAuth, filters: JournalFilters, page: PageParams): Promise<Paginated<JournalEntry>> {
  return apiRequest("/api/v1/audit/", { auth, query: { ...filters, ...page }, schema: paginatedSchema(journalEntrySchema) })
}

const memberNameSchema = z.object({ userId: z.string(), fullName: z.string() })

/** Сотрудники для фильтра «Кто» и для имён в деталях смены ответственного (область — как у `/staff/`) */
export async function fetchJournalPeople(auth: ApiAuth): Promise<{ userId: string; fullName: string }[]> {
  const page = await apiRequest("/api/v1/staff/", { auth, schema: paginatedSchema(memberNameSchema) })
  return page.results
}
