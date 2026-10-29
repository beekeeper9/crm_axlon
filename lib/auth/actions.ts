"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { PASSWORD_MIN_LENGTH } from "@/config/auth"
import { isMockDataSource } from "@/config/env"
import { homeRouteFor } from "@/config/navigation"
import { routes } from "@/config/routes"
import { fetchMe, logout, obtainTokens, type Me } from "@/lib/api/auth-api"
import type { TokenPair, TokenStore } from "@/lib/api/auth-session"
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

export type LoginErrorKind = "invalid" | "deactivated" | "no_company" | "unavailable" | "validation"

export type LoginState = {
  error: { kind: LoginErrorKind; message: string } | null
  /** request_id из ответа backend — пользователь может назвать его поддержке */
  requestId: string | null
  login: string
}

const credentialsSchema = z.object({
  login: z.string().trim().min(1, "Введите логин"),
  password: z.string().min(1, "Введите пароль"),
})

/** Один текст для неверного логина и неверного пароля — не подсказываем, какой аккаунт существует */
const INVALID_CREDENTIALS = "Неверный логин или пароль."
const DEACTIVATED = "Аккаунт отключён. Если это ошибка, обратитесь к руководителю."

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

function apiLoginError(error: unknown): { kind: LoginErrorKind; message: string; requestId: string | null } {
  if (!(error instanceof ApiError)) return { kind: "unavailable", message: API_ERROR_MESSAGES.server, requestId: null }
  const requestId = error.requestId ?? null
  // Коды account_disabled / user_inactive — предложение к контракту (API_CONTRACT.md)
  if (error.code === "account_disabled" || error.code === "user_inactive") return { kind: "deactivated", message: DEACTIVATED, requestId }
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
  const parsed = credentialsSchema.safeParse({ login: loginValue, password: formData.get("password") })
  if (!parsed.success) {
    return { error: { kind: "validation", message: parsed.error.issues[0]?.message ?? "Проверьте поля" }, requestId: null, login: loginValue }
  }
  const next = safeReturnPath(formData.get("next"))

  if (isMockDataSource) {
    const result = demoVerifyCredentials(parsed.data.login, parsed.data.password)
    if (!result.ok) {
      return { error: result.reason === "deactivated" ? { kind: "deactivated", message: DEACTIVATED } : { kind: "invalid", message: INVALID_CREDENTIALS }, requestId: null, login: loginValue }
    }
    ;(await cookies()).set(DEMO_SESSION_COOKIE, demoCreateSession(result.account.id), sessionCookieOptions())
    redirect(result.account.mustChangePassword ? routes.changePassword : (next ?? homeRouteFor(result.account.role)))
  }

  let destination: string
  try {
    const tokens = await obtainTokens({ username: parsed.data.login, password: parsed.data.password })
    await writableTokenStore.write(tokens)
    // Только что полученная пара свежая — читаем её напрямую, а не из cookie текущего запроса
    const me = await fetchMe({ tokens: fixedTokenStore(tokens), refreshOnUnauthorized: false })

    if (me.memberships.length === 0 && !me.isPlatformAdmin) {
      await writableTokenStore.clear()
      return { error: { kind: "no_company", message: "У этой учётной записи нет доступа ни к одной компании. Обратитесь к руководителю." }, requestId: null, login: loginValue }
    }
    if (me.memberships.length === 1) await setTenant(me.memberships[0].tenant)
    const role = roleOf(me)
    if (me.mustChangePassword) destination = routes.changePassword
    else if (!role) destination = `${routes.selectCompany}${next ? `?next=${encodeURIComponent(next)}` : ""}`
    else destination = next ?? homeRouteFor(role)
  } catch (error) {
    const { kind, message, requestId } = apiLoginError(error)
    return { error: { kind, message }, requestId, login: loginValue }
  }
  redirect(destination)
}

/** Выбор компании проверяется по списку членств из /me/, а не верится на слово */
export async function selectCompany(formData: FormData): Promise<void> {
  if (isMockDataSource) redirect(routes.myDay)
  const slug = formData.get("tenant")
  const me = await fetchMe(await getActionAuth())
  const membership = me.memberships.find((item) => item.tenant === slug)
  if (!membership) redirect(routes.selectCompany)
  await setTenant(membership.tenant)
  redirect(safeReturnPath(formData.get("next")) ?? homeRouteFor(uiRoleFromBackend(membership.role)))
}

export async function signOut(): Promise<void> {
  if (isMockDataSource) {
    const store = await cookies()
    demoDestroySession(store.get(DEMO_SESSION_COOKIE)?.value)
    store.delete(DEMO_SESSION_COOKIE)
    redirect(routes.login)
  }
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
    // Endpoint смены пароля не согласован (API_CONTRACT.md) — не делаем вид, что пароль сменён
    return { error: "Смена пароля ещё не подключена к серверу. Обратитесь к администратору.", fieldErrors: {} }
  }

  const account = demoSessionAccount((await cookies()).get(DEMO_SESSION_COOKIE)?.value)
  if (!account) redirect(`${routes.login}?reason=expired`)
  const result = demoChangePassword(account.id, parsed.data.currentPassword, parsed.data.newPassword)
  if (!result.ok) return { error: null, fieldErrors: { [result.field]: result.message } }
  redirect(homeRouteFor(account.role))
}
