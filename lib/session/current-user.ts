import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { env, isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { fetchMe } from "@/lib/api/auth-api"
import { ApiError } from "@/lib/api/errors"
import { getRenderAuth } from "@/lib/auth/token-store"
import { uiRoleFromBackend } from "@/lib/permissions/backend-roles"
import { ROLES, type Role } from "@/lib/permissions/roles"
import { DEMO_ROLE_COOKIE } from "@/lib/session/demo-role"
import { demoUsers } from "@/mocks/users"

export type CurrentUser = {
  id: string
  fullName: string
  role: Role
  companyName: string
  departmentName: string
}

function parseRole(value: string | undefined): Role | undefined {
  return ROLES.find((role) => role === value)
}

async function getDemoUser(): Promise<CurrentUser> {
  const cookieRole = parseRole((await cookies()).get(DEMO_ROLE_COOKIE)?.value)
  return demoUsers[cookieRole ?? env.NEXT_PUBLIC_DEMO_ROLE]
}

/**
 * Пользователь из `GET /api/v1/me/` и роль в выбранной компании.
 * ФИО, название компании и отдела backend пока не отдаёт — показываем логин и slug (вопрос в API_CONTRACT.md).
 */
async function getApiUser(): Promise<CurrentUser> {
  const auth = await getRenderAuth()
  let me
  try {
    me = await fetchMe(auth)
  } catch (error) {
    if (error instanceof ApiError && error.kind === "unauthorized") redirect(routes.login)
    throw error
  }
  const membership = me.memberships.find((item) => item.tenant === auth.tenant)
  if (!membership) redirect(routes.selectCompany)

  return {
    id: me.id,
    fullName: me.username,
    role: uiRoleFromBackend(membership.role),
    companyName: membership.tenant,
    departmentName: "",
  }
}

/**
 * Текущий пользователь. В режиме "mock" — демо-пользователь выбранной роли
 * (cookie переключателя → NEXT_PUBLIC_DEMO_ROLE), в режиме "api" — из backend.
 * cache: шапка и страница в одном запросе обращаются к /me/ один раз.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  return isMockDataSource ? getDemoUser() : getApiUser()
})
