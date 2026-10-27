import { env, isMockDataSource } from "@/config/env"
import { contractPending } from "@/lib/api/errors"
import type { Role } from "@/lib/permissions/roles"
import { demoUsers } from "@/mocks/users"

export type CurrentUser = {
  id: string
  fullName: string
  role: Role
  companyName: string
  departmentName: string
}

/**
 * Текущий пользователь. Авторизация с backend ещё не согласована,
 * поэтому в режиме "mock" возвращается демо-пользователь выбранной роли.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  if (isMockDataSource) return demoUsers[env.NEXT_PUBLIC_DEMO_ROLE]
  return contractPending("GET текущий пользователь")
}
