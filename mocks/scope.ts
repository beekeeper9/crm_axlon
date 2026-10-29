/**
 * Область видимости в демо-режиме — так же, как её применяет backend (own/team/all):
 * менеджер получает только свои записи, даже если страница попросила чужие.
 * Интерфейс не «прячет» чужие данные — они просто не приходят.
 */
import { ApiError } from "@/lib/api/errors"
import { hasPermission, type Permission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

/** id сотрудника, которым ограничена выдача, или null — видна вся команда */
export async function demoOwnScope(): Promise<string | null> {
  const user = await getCurrentUser()
  return hasPermission(user.role, "team.view") ? null : user.id
}

/** Запрошенный фильтр по сотруднику с учётом области видимости */
export async function demoScopedManagerId(requested: string | null): Promise<string | null> {
  return (await demoOwnScope()) ?? requested
}

/** Как backend ответит 403 на чужой ресурс */
export async function demoRequirePermission(permission: Permission): Promise<void> {
  const user = await getCurrentUser()
  if (!hasPermission(user.role, permission)) {
    throw new ApiError("forbidden", "Нет прав на эти данные", { status: 403 })
  }
}
