import { isMockDataSource } from "@/config/env"
import { hasPermission, type Role } from "@/lib/permissions/roles"

/**
 * Как интерфейс обрабатывает изменения данных:
 * - demo — изменения живут только в браузере и честно подписаны как демонстрационные;
 * - unavailable — API операции ещё не согласован, действие выключено с пояснением;
 * - read-only — у роли нет права менять данные (окончательно права проверяет backend).
 */
export type EditMode = "demo" | "unavailable" | "read-only"

export function editModeFor(role: Role): EditMode {
  if (!hasPermission(role, "records.edit")) return "read-only"
  return isMockDataSource ? "demo" : "unavailable"
}

export const EDIT_UNAVAILABLE_HINT = "Станет доступно после согласования API с backend"
