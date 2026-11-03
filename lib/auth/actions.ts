"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { PASSWORD_MIN_LENGTH } from "@/config/auth"
import { isMockDataSource } from "@/config/env"
import { homeRouteFor } from "@/config/navigation"
import { routes } from "@/config/routes"
import { toggleOwnSession } from "@/features/staff/api/work-sessions"
import { changeOwnPassword, fetchMe, logout, obtainTokens, type Me } from "@/lib/api/auth-api"
import type { ApiAuth, TokenPair, TokenStore } from "@/lib/api/auth-session"
import { API_ERROR_MESSAGES, ApiError } from "@/lib/api/errors"
import { TENANT_COOKIE, tokenCookieOptions } from "@/lib/auth/cookies"
import { getActionAuth, writableTokenStore } from "@/lib/auth/token-store"
import { uiRoleFromBackend } from "@/lib/permissions/backend-roles"
import type { Role } from "@/lib/permissions/roles"
import { getSessionState } from "@/lib/session/current-user"
import { DEMO_SESSION_COOKIE } from "@/lib/session/demo-session"
import {
  demoChangePassword,
  demoCreateSession,
  demoDestroySession,
  demoSessionAccount,
  demoVerifyCredentials,
} from "@/mocks/demo-accounts"

export type LoginErrorKind =
  | "invalid"
  | "deactivated"
  | "no_company"
  | "unavailable"
  | "validation"
  /** У аккаунта включена MFA: нужен одноразовый код (backend: 401 `mfa_required`) */
  | "mfa_required"
  /** Код неверный или устарел (backend: 401 `invalid_otp`) */
  | "invalid_otp"
  /** Слишком много неудачных попыток: вход временно заблокирован (backend: 429 `account_locked`) */
  | "locked"
  /** Ограничение частоты запросов (backend: 429 `throttled`) */
  | "rate_limited"

export type LoginState = {
  error: { kind: LoginErrorKind; message: string } | null
  /** request_id из ответа backend — пользователь может назвать его поддержке */
  requestId: string | null
  login: string
  /** Показать поле одноразового кода: backend потребовал MFA */
  otpRequired: boolean
}

const credentialsSchema = z.object({
  login: z.string().trim().min(1, "Введите логин"),
  password: z.string().min(1, "Введите пароль"),
  /** Одноразовый код TOTP или резервный код; пустой — MFA не запрошена */
  otp: z.string().trim().max(64).optional(),
})

/** Один текст для неверного логина и неверного пароля — не подсказываем, какой аккаунт существует */
const INVALID_CREDENTIALS = "Неверный логин или пароль."
const DEACTIVATED = "Аккаунт отключён. Если это ошибка, обратитесь к руководителю."
const MFA_REQUIRED = "Для этого аккаунта включена двухфакторная защита. Введите пароль ещё раз и код из приложения-аутентификатора."
const INVALID_OTP = "Код неверный или устарел. Введите пароль и новый код."
const LOCKED = "Слишком много неудачных попыток. Вход временно заблокирован — попробуйте позже."

function rateLimitedMessage(retryAfterSeconds: number | undefined): string {
  if (!retryAfterSeconds) return "Слишком много попыток входа. Подождите минуту и попробуйте снова."
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60))
  return `Слишком много попыток входа. Попробуйте снова через ${minutes} мин.`
}

/** Возврат только на свою страницу: защита от перенаправления на чужой сайт */
function safeReturnPath(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : null
}

function sessionCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" }
}

function fixedTokenStore(tokens: TokenPair): TokenStore {
  return { read: async () => tokens, write: async () => {}, clear: async () => {} }
}

async function setTenant(slug: string): Promise<void> {
  ;(await cookies()).set(TENANT_COOKIE, slug, tokenCookieOptions())
}

/**
 * Коды ошибок входа по коду backend (`identity/presentation/auth_errors.py`, simplejwt):
 * неверный логин или пароль и отключённый аккаунт — одинаково 401 (`authentication_failed`).
 * Поэтому любой 401 без кода MFA считается неверными учётными данными.
 */
function apiLoginError(error: unknown): { kind: LoginErrorKind; message: string; requestId: string | null } {
  if (!(error instanceof ApiError)) return { kind: "unavailable", message: API_ERROR_MESSAGES.server, requestId: null }
  const requestId = error.requestId ?? null
  if (error.code === "mfa_required") return { kind: "mfa_required", message: MFA_REQUIRED, requestId }
  if (error.code === "invalid_otp") return { kind: "invalid_otp", message: INVALID_OTP, requestId }
  if (error.code === "account_locked") return { kind: "locked", message: LOCKED, requestId }
  if (error.kind === "rate_limited") return { kind: "rate_limited", message: rateLimitedMessage(error.retryAfterSeconds), requestId }
  if (error.kind === "unauthorized" || error.kind === "validation") return { kind: "invalid", message: INVALID_CREDENTIALS, requestId }
  return { kind: "unavailable", message: "Сервер временно недоступен. Попробуйте через минуту.", requestId }
}

function roleOf(me: Me): Role | null {
  if (me.isPlatformAdmin) return "platform_admin"
  return me.memberships.length === 1 ? uiRoleFromBackend(me.memberships[0].role) : null
}

/**
 * Вход. Роль не выбирается: её определяет backend (в демо — демо-хранилище) после проверки пароля.
 * Дальше: временный пароль → обязательная смена; иначе — стартовая страница роли.
 */
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const loginValue = String(formData.get("login") ?? "")
  const otpValue = formData.get("otp")
  const parsed = credentialsSchema.safeParse({
    login: loginValue,
    password: formData.get("password"),
    otp: typeof otpValue === "string" && otpValue.trim() ? otpValue : undefined,
  })
  // Поле кода остаётся на экране, пока его запросил backend
  const otpRequested = typeof otpValue === "string"
  if (!parsed.success) {
    return {
      error: { kind: "validation", message: parsed.error.issues[0]?.message ?? "Проверьте поля" },
      requestId: null,
      login: loginValue,
      otpRequired: otpRequested,
    }
  }
  const next = safeReturnPath(formData.get("next"))

  if (isMockDataSource) {
    const result = demoVerifyCredentials(parsed.data.login, parsed.data.password)
    if (!result.ok) {
      return {
        error: result.reason === "deactivated" ? { kind: "deactivated", message: DEACTIVATED } : { kind: "invalid", message: INVALID_CREDENTIALS },
        requestId: null,
        login: loginValue,
        otpRequired: false,
      }
    }
    ;(await cookies()).set(DEMO_SESSION_COOKIE, demoCreateSession(result.account.id), sessionCookieOptions())
    redirect(result.account.mustChangePassword ? routes.changePassword : (next ?? homeRouteFor(result.account.role)))
  }

  let destination: string
  try {
    const tokens = await obtainTokens({ username: parsed.data.login, password: parsed.data.password, otp: parsed.data.otp })
    await writableTokenStore.write(tokens)
    // Только что полученная пара свежая — читаем её напрямую, а не из cookie текущего запроса
    const me = await fetchMe({ tokens: fixedTokenStore(tokens), refreshOnUnauthorized: false })

    if (me.memberships.length === 0 && !me.isPlatformAdmin) {
      await writableTokenStore.clear()
      return {
        error: { kind: "no_company", message: "У этой учётной записи нет доступа ни к одной компании. Обратитесь к руководителю." },
        requestId: null,
        login: loginValue,
        otpRequired: false,
      }
    }
    if (me.memberships.length === 1) {
      await setTenant(me.memberships[0].tenant)
      await markWork({ tokens: fixedTokenStore(tokens), tenant: me.memberships[0].tenant, refreshOnUnauthorized: false }, "start")
    }
    const role = roleOf(me)
    if (me.mustChangePassword) destination = routes.changePassword
    else if (!role) destination = `${routes.selectCompany}${next ? `?next=${encodeURIComponent(next)}` : ""}`
    else destination = next ?? homeRouteFor(role)
  } catch (error) {
    const { kind, message, requestId } = apiLoginError(error)
    const otpRequired = otpRequested || kind === "mfa_required" || kind === "invalid_otp"
    return { error: { kind, message }, requestId, login: loginValue, otpRequired }
  }
  redirect(destination)
}

/**
 * Вход в компанию начинает рабочую смену, выход из системы — завершает («во сколько начал и
 * закончил работу» для РОПа и директора). Ошибка отметки не мешает входу и выходу.
 */
async function markWork(auth: ApiAuth, action: "start" | "stop"): Promise<void> {
  try {
    await toggleOwnSession(auth, action)
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
  }
}

/** Выбор компании проверяется по списку членств из /me/, а не верится на слово */
export async function selectCompany(formData: FormData): Promise<void> {
  if (isMockDataSource) redirect(routes.myDay)
  const slug = formData.get("tenant")
  const me = await fetchMe(await getActionAuth())
  const membership = me.memberships.find((item) => item.tenant === slug)
  if (!membership) redirect(routes.selectCompany)
  await setTenant(membership.tenant)
  await markWork({ ...(await getActionAuth()), tenant: membership.tenant }, "start")
  redirect(safeReturnPath(formData.get("next")) ?? homeRouteFor(uiRoleFromBackend(membership.role)))
}

export async function signOut(): Promise<void> {
  if (isMockDataSource) {
    const store = await cookies()
    demoDestroySession(store.get(DEMO_SESSION_COOKIE)?.value)
    store.delete(DEMO_SESSION_COOKIE)
    redirect(routes.login)
  }
  await markWork(await getActionAuth(), "stop")
  try {
    await logout(await getActionAuth())
  } catch {
    // Сессия на backend могла уже истечь — локальные токены всё равно удалены
  }
  redirect(routes.login)
}

export type ChangePasswordState = {
  error: string | null
  fieldErrors: Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль"),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH, `Не короче ${PASSWORD_MIN_LENGTH} символов`),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, { message: "Пароли не совпадают", path: ["confirmPassword"] })

/**
 * Ошибки `POST /auth/password/change/`: неверный текущий пароль — 400 `validation_error` без полей,
 * правила нового пароля — 400 с `details.new_password` (тексты валидаторов Django).
 */
function apiChangePasswordError(error: unknown): ChangePasswordState {
  if (!(error instanceof ApiError)) throw error
  if (error.kind === "unauthorized") redirect(`${routes.login}?reason=expired`)
  if (error.kind === "validation") {
    const newPassword = error.fieldErrors?.newPassword?.[0]
    return newPassword
      ? { error: null, fieldErrors: { newPassword } }
      : { error: null, fieldErrors: { currentPassword: "Текущий пароль указан неверно" } }
  }
  if (error.kind === "not_found") {
    return { error: "Сервер не поддерживает смену пароля. Обратитесь к администратору.", fieldErrors: {} }
  }
  return { error: API_ERROR_MESSAGES[error.kind], fieldErrors: {} }
}

/** Смена пароля: обязательная после входа по временному паролю и по желанию — из профиля */
export async function changePassword(_previous: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const state = await getSessionState()
  if (!state) redirect(`${routes.login}?reason=expired`)

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  })
  if (!parsed.success) {
    const fieldErrors: ChangePasswordState["fieldErrors"] = {}
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as keyof ChangePasswordState["fieldErrors"]] ??= issue.message
    return { error: null, fieldErrors }
  }

  if (!isMockDataSource) {
    try {
      await changeOwnPassword(await getActionAuth(), {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      })
    } catch (error) {
      return apiChangePasswordError(error)
    }
    // Флаг временного пароля backend снял; токены после смены пароля остаются действительными
    redirect(homeRouteFor(state.user.role))
  }

  const account = demoSessionAccount((await cookies()).get(DEMO_SESSION_COOKIE)?.value)
  if (!account) redirect(`${routes.login}?reason=expired`)
  const result = demoChangePassword(account.id, parsed.data.currentPassword, parsed.data.newPassword)
  if (!result.ok) return { error: null, fieldErrors: { [result.field]: result.message } }
  redirect(homeRouteFor(account.role))
}
