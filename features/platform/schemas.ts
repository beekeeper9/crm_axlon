import { z } from "zod"

/**
 * Панель администратора платформы. Контракт: `GET/POST /api/v1/platform/...` (pied-piper,
 * модуль platform_admin); ответы приходят в camelCase после клиента API.
 */

export const PLAN_CODES = ["free", "pro", "enterprise"] as const
export const FEATURES = ["telephony", "communications", "payments", "analytics", "ai", "operations", "risk"] as const
export const ACCESS_STATES = ["active", "expiring", "expired", "past_due", "cancelled"] as const
export const SUBSCRIPTION_STATUSES = ["active", "past_due", "cancelled"] as const
export const ERROR_STATUSES = ["new", "acknowledged", "resolved"] as const
export const TICKET_STATUSES = ["new", "in_progress", "resolved", "closed"] as const
export const TICKET_KINDS = ["question", "problem", "feedback", "idea"] as const

export const planCodeSchema = z.enum(PLAN_CODES)
export const featureSchema = z.enum(FEATURES)
export const accessStateSchema = z.enum(ACCESS_STATES)
export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES)

export const subscriptionSchema = z.object({
  planCode: planCodeSchema,
  status: subscriptionStatusSchema,
  accessState: accessStateSchema,
  startsOn: z.iso.date(),
  /** Последний день доступа включительно; null — бессрочно */
  endsOn: z.iso.date().nullable(),
  /** null — модули не ограничены (подписка создана до каталога модулей) */
  features: z.array(featureSchema).nullable(),
})

export const companySummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  /** Состояние базы данных компании: provisioning | active | failed … */
  tenantStatus: z.string().nullable(),
  users: z.int().nonnegative(),
  subscription: subscriptionSchema.nullable(),
  /** Структура компании: только действующие аккаунты, каждый человек один раз (считает backend) */
  staff: z
    .object({
      employees: z.int().nonnegative(),
      leaders: z.int().nonnegative(),
      departments: z.int().nonnegative(),
      headsOfSales: z.int().nonnegative(),
      managers: z.int().nonnegative(),
    })
    .nullable()
    .default(null),
})

export const companyDetailSchema = companySummarySchema.extend({
  country: z.string(),
  currency: z.string(),
  timezone: z.string(),
  departments: z.int().nonnegative(),
  directors: z.array(
    z.object({
      userId: z.string(),
      login: z.string(),
      fullName: z.string(),
      isActive: z.boolean(),
      status: z.enum(["active", "invited", "deactivated"]),
      lastLogin: z.iso.datetime({ offset: true }).nullable(),
    })
  ),
  history: z.array(
    z.object({
      occurredAt: z.iso.datetime({ offset: true }),
      action: z.string(),
      actor: z.string().nullable(),
      changedFields: z.array(z.string()),
    })
  ),
})

export const createdCompanySchema = z.object({
  company: companyDetailSchema,
  /** Временный пароль директора — только в этом ответе */
  director: z.object({ login: z.string(), temporaryPassword: z.string() }),
})

const moneySchema = z.object({ currency: z.string(), amount: z.string() })

export const overviewSchema = z.object({
  periodDays: z.int(),
  companies: z.object({ total: z.int(), active: z.int(), suspended: z.int(), newInPeriod: z.int() }),
  subscriptions: z.object({
    active: z.int(),
    expiring: z.int(),
    expired: z.int(),
    pastDue: z.int(),
    cancelled: z.int(),
    none: z.int(),
    givingAccess: z.int(),
    byPlan: z.record(z.string(), z.int()),
  }),
  users: z.object({ active: z.int() }),
  revenue: z.object({
    /** Сумма прейскурантных цен назначенных тарифов — НЕ полученные деньги */
    assignedMonthly: z.array(moneySchema),
    received: z.array(moneySchema).nullable(),
    receivedUnavailableReason: z.string().nullable(),
    overdue: z.array(moneySchema).nullable(),
  }),
  errors: z.object({ new: z.int(), inPeriod: z.int() }),
  tickets: z.object({ open: z.int(), inPeriod: z.int() }),
})

export const catalogSchema = z.object({
  plans: z.array(
    z.object({
      code: planCodeSchema,
      name: z.string(),
      monthlyPrice: z.string(),
      currency: z.string(),
      limits: z.record(z.string(), z.int()),
      features: z.array(featureSchema),
    })
  ),
  features: z.array(featureSchema),
})

export const errorRecordSchema = z.object({
  id: z.string(),
  occurredAt: z.iso.datetime({ offset: true }),
  component: z.string(),
  view: z.string(),
  method: z.string(),
  route: z.string(),
  exceptionType: z.string(),
  requestId: z.string().nullable(),
  tenantSlug: z.string().nullable(),
  status: z.enum(ERROR_STATUSES),
  handledAt: z.iso.datetime({ offset: true }).nullable(),
})

export const ticketSchema = z.object({
  id: z.string(),
  company: z.object({ id: z.string(), name: z.string() }),
  author: z.object({ id: z.string(), name: z.string() }),
  kind: z.enum(TICKET_KINDS),
  subject: z.string(),
  body: z.string(),
  status: z.enum(TICKET_STATUSES),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  /** Только у администратора платформы */
  internalNote: z.string().optional(),
})

export type PlanCode = z.infer<typeof planCodeSchema>
export type Feature = z.infer<typeof featureSchema>
export type AccessState = z.infer<typeof accessStateSchema>
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>
export type Subscription = z.infer<typeof subscriptionSchema>
export type CompanySummary = z.infer<typeof companySummarySchema>
export type CompanyDetail = z.infer<typeof companyDetailSchema>
export type CreatedCompany = z.infer<typeof createdCompanySchema>
export type Overview = z.infer<typeof overviewSchema>
export type Catalog = z.infer<typeof catalogSchema>
export type ErrorRecord = z.infer<typeof errorRecordSchema>
export type ErrorStatus = ErrorRecord["status"]
export type Ticket = z.infer<typeof ticketSchema>
export type TicketStatus = Ticket["status"]
export type TicketKind = Ticket["kind"]

export type CompanyFilters = {
  search: string | null
  status: "active" | "suspended" | null
  plan: PlanCode | null
  access: AccessState | null
}

export type Terms = {
  planCode: PlanCode
  startsOn: string
  endsOn: string | null
  features: Feature[]
  status: SubscriptionStatus
}
