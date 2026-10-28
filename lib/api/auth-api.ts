import { z } from "zod"

import type { ApiAuth, TokenPair } from "@/lib/api/auth-session"
import { AUTH_PATHS, apiRequest } from "@/lib/api/client"
import { backendRoleSchema } from "@/lib/permissions/backend-roles"

/**
 * Согласованные endpoint авторизации (JWT Bearer).
 * Вызываются только в режиме api, когда выбрано хранилище токенов.
 */

const tokenPairSchema = z.object({ access: z.string(), refresh: z.string() })

/** `GET /api/v1/me/` — `tenant` в членстве это slug компании */
export const meSchema = z.object({
  id: z.union([z.string(), z.int()]).transform(String),
  username: z.string(),
  memberships: z.array(z.object({ tenant: z.string(), role: backendRoleSchema })),
})

export type Me = z.infer<typeof meSchema>

/** Запросы пользователя и сессии не относятся к компании — X-Tenant им не нужен */
function withoutTenant(auth: ApiAuth): ApiAuth {
  return { ...auth, tenant: undefined }
}

/** Поля тела запроса (`username`, `password`) нужно подтвердить у backend */
export function obtainTokens(credentials: { username: string; password: string }): Promise<TokenPair> {
  return apiRequest(AUTH_PATHS.token, { method: "POST", body: credentials, schema: tokenPairSchema })
}

export function fetchMe(auth: ApiAuth): Promise<Me> {
  return apiRequest(AUTH_PATHS.me, { schema: meSchema, auth: withoutTenant(auth) })
}

/** Завершает текущую сессию (один refresh-токен). Локальные токены удаляются в любом случае. */
export async function logout(auth: ApiAuth): Promise<void> {
  try {
    const tokens = await auth.tokens.read()
    if (tokens) {
      await apiRequest(AUTH_PATHS.logout, {
        method: "POST",
        body: { refresh: tokens.refresh },
        schema: z.unknown(),
        auth: withoutTenant(auth),
      })
    }
  } finally {
    await auth.tokens.clear()
  }
}

/** Завершает все сессии пользователя */
export async function logoutAll(auth: ApiAuth): Promise<void> {
  try {
    await apiRequest(AUTH_PATHS.logoutAll, { method: "POST", schema: z.unknown(), auth: withoutTenant(auth) })
  } finally {
    await auth.tokens.clear()
  }
}
