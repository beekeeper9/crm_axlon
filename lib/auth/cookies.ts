import { z } from "zod"

/**
 * Имена и параметры cookie, в которых сервер Next.js хранит пару JWT и выбранную компанию.
 * httpOnly: JavaScript страницы токены не видит. В Python backend они уходят только
 * заголовком Authorization: Bearer — это не cookie-сессия backend.
 */
export const ACCESS_COOKIE = "crm_access"
export const REFRESH_COOKIE = "crm_refresh"
export const TENANT_COOKIE = "crm_tenant"

/** Обновляем access заранее, чтобы он не истёк посреди загрузки страницы */
export const ACCESS_REFRESH_MARGIN_MS = 60_000

type CookieOptions = {
  httpOnly: true
  secure: boolean
  sameSite: "lax"
  path: "/"
  expires?: Date
}

const jwtPayloadSchema = z.object({ exp: z.number().optional() })

/**
 * Срок действия из поля exp токена. Подпись здесь не проверяется — это делает backend;
 * срок нужен только чтобы вовремя обновить токен и выставить время жизни cookie.
 */
export function tokenExpiresAt(token: string): number | null {
  const payload = token.split(".")[1]
  if (!payload) return null
  try {
    const json: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    const parsed = jwtPayloadSchema.safeParse(json)
    return parsed.success && parsed.data.exp ? parsed.data.exp * 1000 : null
  } catch {
    return null
  }
}

export function isAccessTokenFresh(token: string | undefined, now: number = Date.now()): boolean {
  if (!token) return false
  const expiresAt = tokenExpiresAt(token)
  // Без exp не можем судить о сроке — считаем свежим, backend ответит 401, если это не так
  return expiresAt === null || expiresAt - now > ACCESS_REFRESH_MARGIN_MS
}

export function tokenCookieOptions(token?: string): CookieOptions {
  const expiresAt = token ? tokenExpiresAt(token) : null
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(expiresAt ? { expires: new Date(expiresAt) } : {}),
  }
}
