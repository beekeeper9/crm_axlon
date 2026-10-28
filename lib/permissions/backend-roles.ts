import { z } from "zod"

import type { Role } from "@/lib/permissions/roles"

/**
 * Роли, которые возвращает backend в `memberships[].role`.
 * Это другой словарь, чем роли интерфейса: backend-роль `manager` — руководитель,
 * а «менеджер» интерфейса — менеджер по продажам (`sales_rep`). Поэтому соответствие явное.
 */
export const BACKEND_ROLES = ["owner", "admin", "manager", "sales_rep", "viewer"] as const

export const backendRoleSchema = z.enum(BACKEND_ROLES)

export type BackendRole = z.infer<typeof backendRoleSchema>

/**
 * Единственное место перевода ролей backend в роли интерфейса.
 * ПРЕДЛОЖЕНИЕ: смысл `admin` (администратор компании) нужно подтвердить —
 * пока он получает интерфейс директора. Администратор платформы — не роль компании.
 */
const UI_ROLE_BY_BACKEND_ROLE: Record<BackendRole, Role> = {
  owner: "director",
  admin: "director",
  manager: "head_of_sales",
  sales_rep: "manager",
  viewer: "viewer",
}

export function uiRoleFromBackend(role: BackendRole): Role {
  return UI_ROLE_BY_BACKEND_ROLE[role]
}
