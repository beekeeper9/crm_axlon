import { redirect } from "next/navigation"

import { homeRouteFor } from "@/config/navigation"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

/** Панель открывается только администратору платформы; backend проверяет право ещё раз */
export async function requirePlatformAdmin(): Promise<void> {
  const user = await getCurrentUser()
  if (!hasPermission(user.role, "platform.manage")) redirect(homeRouteFor(user.role))
}
