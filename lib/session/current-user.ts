import { cookies } from "next/headers"

import { env, isMockDataSource } from "@/config/env"
import { contractPending } from "@/lib/api/errors"
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

/**
 * Текущий пользователь. Авторизация с backend ещё не согласована,
 * поэтому в режиме "mock" возвращается демо-пользователь выбранной роли
 * (cookie переключателя → NEXT_PUBLIC_DEMO_ROLE).
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  if (!isMockDataSource) return contractPending("GET текущий пользователь")

  const cookieRole = parseRole((await cookies()).get(DEMO_ROLE_COOKIE)?.value)
  return demoUsers[cookieRole ?? env.NEXT_PUBLIC_DEMO_ROLE]
}
