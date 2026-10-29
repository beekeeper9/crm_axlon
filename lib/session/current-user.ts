import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { fetchMe } from "@/lib/api/auth-api"
import { ApiError } from "@/lib/api/errors"
import { getRenderAuth } from "@/lib/auth/token-store"
import { uiRoleFromBackend } from "@/lib/permissions/backend-roles"
import type { Role } from "@/lib/permissions/roles"
import { DEMO_SESSION_COOKIE } from "@/lib/session/demo-session"
import { demoCompany, demoDepartment, demoSessionAccount } from "@/mocks/demo-accounts"

export type CurrentUser = {
  id: string
  login: string
  fullName: string
  role: Role
  companyName: string
  departmentName: string
}

export type SessionState = {
  user: CurrentUser
  /** Вход по временному паролю: до смены пароля рабочие разделы закрыты */
  mustChangePassword: boolean
}

async function getDemoSession(): Promise<SessionState | null> {
  const account = demoSessionAccount((await cookies()).get(DEMO_SESSION_COOKIE)?.value)
  if (!account) return null
  return {
    user: {
      id: account.id,
      login: account.login,
      fullName: account.fullName,
      role: account.role,
      companyName: demoCompany(account.companyId)?.name ?? "",
      departmentName: demoDepartment(account.departmentId)?.name ?? "",
    },
    mustChangePassword: account.mustChangePassword,
  }
}

/**
 * Пользователь из `GET /api/v1/me/` и роль в выбранной компании.
 * Признаки администратора платформы и обязательной смены пароля — ПРЕДЛОЖЕНИЕ к контракту
 * (см. API_CONTRACT.md); пока backend их не отдаёт, они считаются false.
 */
async function getApiSession(): Promise<SessionState | null> {
  const auth = await getRenderAuth()
  let me
  try {
    me = await fetchMe(auth)
  } catch (error) {
    if (error instanceof ApiError && error.kind === "unauthorized") return null
    throw error
  }
  const base = { id: me.id, login: me.username, fullName: me.fullName ?? me.username }
  if (me.isPlatformAdmin) {
    return { user: { ...base, role: "platform_admin", companyName: "", departmentName: "" }, mustChangePassword: me.mustChangePassword }
  }
  const membership = me.memberships.find((item) => item.tenant === auth.tenant)
  if (!membership) redirect(routes.selectCompany)
  return {
    user: { ...base, role: uiRoleFromBackend(membership.role), companyName: membership.tenant, departmentName: "" },
    mustChangePassword: me.mustChangePassword,
  }
}

/** Сессия без перенаправлений — для страницы смены пароля; null — пользователь не вошёл */
export const getSessionState = cache(async (): Promise<SessionState | null> => {
  return isMockDataSource ? getDemoSession() : getApiSession()
})

/**
 * Текущий пользователь для рабочих разделов (один раз на запрос).
 * Без входа — на страницу входа; с временным паролем — на обязательную смену пароля.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const state = await getSessionState()
  if (!state) redirect(`${routes.login}?reason=expired`)
  if (state.mustChangePassword) redirect(routes.changePassword)
  return state.user
})
