import { z } from "zod"

import type { ApiAuth, TokenPair } from "@/lib/api/auth-session"
import { AUTH_PATHS, apiRequest } from "@/lib/api/client"
import { backendRoleSchema } from "@/lib/permissions/backend-roles"

/**
 * Согласованные endpoint авторизации (JWT Bearer).
 * Вызываются только в режиме api, когда выбрано хранилище токенов.
 */

const tokenPairSchema = z.object({ access: z.string(), refresh: z.string() })

/** Компания и отдел в членстве (backend P0-1, `organizations/composition.py`) */
const membershipCompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  currency: z.string(),
  timezone: z.string(),
})

const membershipSchema = z.object({
  /** Slug компании — значение заголовка `X-Tenant` */
  tenant: z.string(),
  role: backendRoleSchema,
  /** Поля ниже есть в backend начиная с P0-1; в более ранней версии их нет */
  company: membershipCompanySchema.optional(),
  department: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  permissions: z.array(z.string()).optional(),
})

/**
 * `GET /api/v1/me/` по коду backend (`identity/presentation/views.py`, `MeView`).
 * `id`, `username`, `memberships` есть во всех версиях; `display_name`, `is_platform_admin`,
 * `must_change_password` и подробности членства — с P0-1, поэтому необязательны.
 */
export const meSchema = z.object({
  id: z.string(),
  username: z.string(),
  memberships: z.array(membershipSchema),
  /** Имя и фамилия, а если их нет — логин */
  displayName: z.string().optional(),
  isPlatformAdmin: z.boolean().optional().default(false),
  mustChangePassword: z.boolean().optional().default(false),
})

export type Me = z.infer<typeof meSchema>
export type Membership = Me["memberships"][number]

/** Запросы пользователя и сессии не относятся к компании — X-Tenant им не нужен */
function withoutTenant(auth: ApiAuth): ApiAuth {
  return { ...auth, tenant: undefined }
}

/**
 * `POST /api/v1/auth/token/` — `{ username, password, otp? }`. `otp` нужен, только если у аккаунта
 * включена MFA: без него backend отвечает 401 `mfa_required`.
 */
export function obtainTokens(credentials: { username: string; password: string; otp?: string }): Promise<TokenPair> {
  return apiRequest(AUTH_PATHS.token, { method: "POST", body: credentials, schema: tokenPairSchema })
}

export function fetchMe(auth: ApiAuth): Promise<Me> {
  return apiRequest(AUTH_PATHS.me, { schema: meSchema, auth: withoutTenant(auth) })
}

/** `POST /api/v1/auth/password/change/` (backend P0-1) → 204; снимает `must_change_password` */
export async function changeOwnPassword(
  auth: ApiAuth,
  passwords: { currentPassword: string; newPassword: string }
): Promise<void> {
  await apiRequest(AUTH_PATHS.passwordChange, {
    method: "POST",
    body: passwords,
    schema: z.null(),
    auth: withoutTenant(auth),
  })
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
