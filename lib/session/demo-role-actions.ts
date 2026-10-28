"use server"

import { cookies } from "next/headers"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { ROLES } from "@/lib/permissions/roles"
import { DEMO_ROLE_COOKIE } from "@/lib/session/demo-role"

const roleSchema = z.enum(ROLES)

/**
 * Переключение роли демо-пользователя. Это не авторизация и не backend:
 * меняется только то, каким демо-пользователем показан интерфейс.
 */
export async function setDemoRole(role: unknown): Promise<void> {
  if (!isMockDataSource) return
  const parsed = roleSchema.safeParse(role)
  if (!parsed.success) return
  ;(await cookies()).set(DEMO_ROLE_COOKIE, parsed.data, { path: "/", sameSite: "lax" })
}
