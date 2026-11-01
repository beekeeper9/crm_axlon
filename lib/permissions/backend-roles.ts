import { z } from "zod"

import type { Role } from "@/lib/permissions/roles"

/**
 * Роли, которые backend хранит и возвращает в `memberships[].role` (`access_control/domain/rbac.py`).
 * Это другой словарь, чем роли интерфейса: backend-роль `manager` — руководитель (устаревшее
 * значение для РОПа), а «менеджер» интерфейса — менеджер по продажам (`sales_rep`).
 * Неизвестные роли backend сам не отдаёт в `/me/`, поэтому список закрытый.
 */
export const BACKEND_ROLES = [
  "owner",
  "admin",
  "director",
  "manager",
  "head_of_sales",
  "sales_rep",
  "lead_caller",
  "operations",
  "viewer",
] as const

export const backendRoleSchema = z.enum(BACKEND_ROLES)

export type BackendRole = z.infer<typeof backendRoleSchema>

/**
 * Единственное место перевода ролей backend в роли интерфейса.
 * Повторяет `PRODUCT_ROLES` backend: owner, admin и director — директор; manager и head_of_sales — РОП.
 * Администратор платформы — не роль компании, а признак `is_platform_admin` в `/me/`.
 */
const UI_ROLE_BY_BACKEND_ROLE: Record<BackendRole, Role> = {
  owner: "director",
  admin: "director",
  director: "director",
  manager: "head_of_sales",
  head_of_sales: "head_of_sales",
  sales_rep: "manager",
  lead_caller: "lead_caller",
  operations: "operations",
  viewer: "viewer",
}

export function uiRoleFromBackend(role: BackendRole): Role {
  return UI_ROLE_BY_BACKEND_ROLE[role]
}

/**
 * Обратный перевод для создания сотрудников: роль интерфейса → хранимая роль backend.
 * Директор, РОП и менеджер создаются с актуальными значениями (не устаревшими owner/manager).
 */
const BACKEND_ROLE_BY_UI_ROLE: Partial<Record<Role, BackendRole>> = {
  director: "director",
  head_of_sales: "head_of_sales",
  manager: "sales_rep",
  lead_caller: "lead_caller",
  operations: "operations",
  viewer: "viewer",
}

export function backendRoleFromUi(role: Role): BackendRole | null {
  return BACKEND_ROLE_BY_UI_ROLE[role] ?? null
}
