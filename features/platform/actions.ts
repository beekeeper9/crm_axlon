"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { platformCompanyRoute, routes } from "@/config/routes"
import { LIMIT_METRICS, UNLIMITED, type MetricUsage } from "@/features/plan-limits/schemas"
import * as platform from "@/features/platform/api/platform-repository"
import { ERROR_STATUSES, FEATURES, PLAN_CODES, SUBSCRIPTION_STATUSES, TICKET_STATUSES, type CreatedCompany } from "@/features/platform/schemas"
import { API_ERROR_MESSAGES, ApiError } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

/**
 * Действия администратора платформы. Право проверяется здесь и ещё раз на backend
 * (`is_platform_admin`): интерфейс лишь не показывает панель другим ролям.
 */

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors: Record<string, string>; requestId: string | null }

const DENIED = { ok: false as const, message: "Это действие доступно только администратору платформы.", fieldErrors: {}, requestId: null }

/** Понятные сообщения для отказов backend по коду ошибки */
const CODE_MESSAGES: Record<string, string> = {
  provisioning_disabled:
    "Создание компаний выключено на сервере (TENANT_PROVISIONING_ENABLED=false). Компания не создана — включите настройку и повторите.",
}

const BACKEND_FIELD_MESSAGES: Record<string, string> = {
  "A company with this short name already exists.": "Компания с таким коротким именем уже есть",
  "This login is already taken.": "Этот логин уже занят",
  "This e-mail is already used by another account.": "Этот e-mail уже используется",
  "Tenant slug must be 3-40 chars: lowercase letters, digits and hyphens.": "3–40 символов: строчные латинские буквы, цифры и дефис",
  "The subscription must end after it starts.": "Окончание должно быть позже начала",
  "Assign a subscription before changing its limits.": "Сначала назначьте компании подписку — лимиты меняются у подписки.",
  "A limit is a whole number, 0 or more, or -1 for none.": "Лимит — целое число от 0 или «без лимита».",
}

function failure(error: unknown): ActionResult<never> {
  if (!(error instanceof ApiError)) throw error
  const fieldErrors: Record<string, string> = {}
  for (const [field, messages] of Object.entries(error.fieldErrors ?? {})) {
    if (messages[0]) fieldErrors[field] = BACKEND_FIELD_MESSAGES[messages[0]] ?? messages[0]
  }
  const known = BACKEND_FIELD_MESSAGES[error.message]
  const message =
    (error.code && CODE_MESSAGES[error.code]) ??
    known ??
    (error.kind === "validation" || error.kind === "conflict" ? error.message : API_ERROR_MESSAGES[error.kind])
  return { ok: false, message, fieldErrors, requestId: error.requestId ?? null }
}

async function isPlatformAdmin(): Promise<boolean> {
  return hasPermission((await getCurrentUser()).role, "platform.manage")
}

const termsSchema = z
  .object({
    planCode: z.enum(PLAN_CODES),
    startsOn: z.iso.date("Укажите дату начала"),
    endsOn: z.union([z.iso.date(), z.literal("")]).transform((value) => value || null),
    features: z.array(z.enum(FEATURES)),
    status: z.enum(SUBSCRIPTION_STATUSES),
  })
  .refine((terms) => !terms.endsOn || terms.endsOn > terms.startsOn, { message: "Окончание должно быть позже начала", path: ["endsOn"] })

const newCompanySchema = z.object({
  name: z.string().trim().min(2, "Укажите название компании").max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, "3–40 символов: строчные латинские буквы, цифры и дефис"),
  country: z.string().regex(/^[A-Z]{2}$/, "Код страны ISO, например KG"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Код валюты ISO, например KGS"),
  timezone: z.string().min(1),
  subscription: termsSchema,
  director: z.object({
    firstName: z.string().trim().min(1, "Укажите имя директора").max(150),
    lastName: z.string().trim().max(150),
    login: z
      .string()
      .trim()
      .refine((value) => value === "" || /^[A-Za-z0-9._@+-]{3,150}$/.test(value), "3–150 символов: латиница, цифры, . _ @ + -"),
    email: z.union([z.email("Неверный e-mail"), z.literal("")]),
    phone: z.string().trim().max(16),
  }),
})

export type NewCompanyForm = z.input<typeof newCompanySchema>

function zodFailure(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message
  return { ok: false, message: "Проверьте выделенные поля.", fieldErrors, requestId: null }
}

/** Компания, её база данных, директор и подписка создаются на backend одной операцией */
export async function createCompanyAction(input: NewCompanyForm): Promise<ActionResult<CreatedCompany>> {
  if (!(await isPlatformAdmin())) return DENIED
  const parsed = newCompanySchema.safeParse(input)
  if (!parsed.success) return zodFailure(parsed.error)
  try {
    const created = await platform.createCompany(await getActionAuth(), parsed.data)
    revalidatePath(routes.platform, "layout")
    return { ok: true, data: created }
  } catch (error) {
    return failure(error)
  }
}

/** Новый временный пароль директора компании; старый пароль и сессии директора отзываются */
export async function issueDirectorCredentialsAction(
  companyId: string,
  userId: string
): Promise<ActionResult<{ login: string; temporaryPassword: string }>> {
  if (!(await isPlatformAdmin())) return DENIED
  try {
    const credentials = await platform.issueDirectorCredentials(await getActionAuth(), companyId, userId)
    revalidatePath(routes.platformCompanies, "layout")
    return { ok: true, data: credentials }
  } catch (error) {
    if (error instanceof ApiError && error.kind === "not_found") {
      return { ok: false, message: "Этот пользователь больше не активный директор компании. Обновите страницу.", fieldErrors: {}, requestId: error.requestId ?? null }
    }
    return failure(error)
  }
}

export type TermsForm = z.input<typeof termsSchema>

export async function setSubscriptionAction(companyId: string, input: TermsForm): Promise<ActionResult> {
  if (!(await isPlatformAdmin())) return DENIED
  const parsed = termsSchema.safeParse(input)
  if (!parsed.success) return zodFailure(parsed.error)
  try {
    await platform.setSubscription(await getActionAuth(), companyId, parsed.data)
    revalidatePath(routes.platform, "layout")
    return { ok: true, data: null }
  } catch (error) {
    return failure(error)
  }
}

const limitsSchema = z.partialRecord(z.enum(LIMIT_METRICS), z.int().min(UNLIMITED))

/**
 * Лимиты компании поверх тарифа. Передаются целиком: метрика, которой нет в limits, снова берётся
 * из тарифа; пустой объект — сбросить все изменения. Backend пишет изменение в аудит платформы.
 */
export async function setCompanyLimitsAction(companyId: string, limits: Partial<Record<MetricUsage["metric"], number>>): Promise<ActionResult> {
  if (!(await isPlatformAdmin())) return DENIED
  const parsed = limitsSchema.safeParse(limits)
  if (!parsed.success) {
    return { ok: false, message: "Лимит — целое число от 0 или «без лимита».", fieldErrors: {}, requestId: null }
  }
  try {
    await platform.setCompanyLimits(await getActionAuth(), companyId, parsed.data)
    revalidatePath(platformCompanyRoute(companyId))
    return { ok: true, data: null }
  } catch (error) {
    return failure(error)
  }
}

export async function updateCompanyAction(companyId: string, patch: { name?: string; isActive?: boolean }): Promise<ActionResult> {
  if (!(await isPlatformAdmin())) return DENIED
  const name = patch.name?.trim()
  if (patch.name !== undefined && (!name || name.length > 200)) {
    return { ok: false, message: "Укажите название компании.", fieldErrors: { name: "Укажите название компании" }, requestId: null }
  }
  try {
    await platform.updateCompany(await getActionAuth(), companyId, { ...(name ? { name } : {}), ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }) })
    revalidatePath(routes.platform, "layout")
    return { ok: true, data: null }
  } catch (error) {
    return failure(error)
  }
}

export async function setErrorStatusAction(errorId: string, status: string): Promise<ActionResult> {
  if (!(await isPlatformAdmin())) return DENIED
  const parsed = z.enum(ERROR_STATUSES).safeParse(status)
  if (!parsed.success) return zodFailure(parsed.error)
  try {
    await platform.setErrorStatus(await getActionAuth(), errorId, parsed.data)
    revalidatePath(routes.platform, "layout")
    return { ok: true, data: null }
  } catch (error) {
    return failure(error)
  }
}

const ticketPatchSchema = z.object({
  status: z.enum(TICKET_STATUSES),
  internalNote: z.string().max(5000, "Не длиннее 5000 символов"),
})

export async function updateTicketAction(ticketId: string, input: z.input<typeof ticketPatchSchema>): Promise<ActionResult> {
  if (!(await isPlatformAdmin())) return DENIED
  const parsed = ticketPatchSchema.safeParse(input)
  if (!parsed.success) return zodFailure(parsed.error)
  try {
    await platform.updateTicket(await getActionAuth(), ticketId, parsed.data)
    revalidatePath(routes.platform, "layout")
    return { ok: true, data: null }
  } catch (error) {
    return failure(error)
  }
}
