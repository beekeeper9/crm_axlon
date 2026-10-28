import { z } from "zod"

import { env } from "@/config/env"
import type { ApiAuth, TokenPair, TokenStore } from "@/lib/api/auth-session"
import { keysToCamel, keysToSnake } from "@/lib/api/case"
import { ApiError, apiErrorFromResponse } from "@/lib/api/errors"

type QueryValue = string | number | boolean | undefined | null

export type ApiRequestOptions<TSchema extends z.ZodType> = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  /** Имена параметров в camelCase — в snake_case их переводит клиент */
  query?: Record<string, QueryValue>
  body?: unknown
  /** Схема ответа (в camelCase): каждый ответ backend проверяется перед использованием. */
  schema: TSchema
  /** Без auth запрос анонимный (например, получение токена) */
  auth?: ApiAuth
  signal?: AbortSignal
}

/** Пути согласованных endpoint авторизации */
export const AUTH_PATHS = {
  token: "/api/v1/auth/token/",
  refresh: "/api/v1/auth/token/refresh/",
  logout: "/api/v1/auth/logout/",
  logoutAll: "/api/v1/auth/logout-all/",
  me: "/api/v1/me/",
} as const

const tokenPairSchema = z.object({ access: z.string(), refresh: z.string() })

function buildUrl(path: string, query?: Record<string, QueryValue>): URL {
  const baseUrl = env.NEXT_PUBLIC_API_BASE_URL
  if (!baseUrl) {
    throw new ApiError("network", "NEXT_PUBLIC_API_BASE_URL не задан")
  }

  const url = new URL(path, baseUrl)
  const snakeQuery = keysToSnake(query ?? {}) as Record<string, QueryValue>
  for (const [key, value] of Object.entries(snakeQuery)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }
  return url
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try {
    return keysToCamel(JSON.parse(text))
  } catch {
    return undefined
  }
}

type SendOptions = {
  method: string
  query?: Record<string, QueryValue>
  body?: unknown
  accessToken?: string
  tenant?: string
  signal?: AbortSignal
}

async function send(path: string, options: SendOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" }
  if (options.body !== undefined) headers["Content-Type"] = "application/json"
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`
  if (options.tenant) headers["X-Tenant"] = options.tenant

  try {
    // Без credentials: "include" — авторизация только заголовком Bearer
    return await fetch(buildUrl(path, options.query), {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(keysToSnake(options.body)),
      signal: options.signal,
      cache: "no-store",
    })
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    throw new ApiError("network", "Не удалось выполнить запрос к API")
  }
}

/** Сколько помнить результат обновления: запросы, пришедшие следом со старым токеном, получат ту же пару */
const REFRESH_REUSE_MS = 10_000

const refreshResults = new Map<string, Promise<TokenPair | null>>()

/**
 * Обменивает refresh-токен на новую пару (refresh ротируется).
 * Один обмен на один refresh-токен: параллельные запросы ждут общий результат,
 * иначе второй отправил бы уже недействительный токен и пользователя выбросило бы из системы.
 */
export function exchangeRefreshToken(refresh: string): Promise<TokenPair | null> {
  const pending = refreshResults.get(refresh)
  if (pending) return pending

  const task = (async () => {
    try {
      const response = await send(AUTH_PATHS.refresh, { method: "POST", body: { refresh } })
      const parsed = tokenPairSchema.safeParse(await readJson(response))
      return response.ok && parsed.success ? parsed.data : null
    } catch {
      return null
    }
  })()

  refreshResults.set(refresh, task)
  setTimeout(() => refreshResults.delete(refresh), REFRESH_REUSE_MS)
  return task
}

async function refreshStoredTokens(store: TokenStore): Promise<TokenPair | null> {
  const current = await store.read()
  if (!current) return null
  const next = await exchangeRefreshToken(current.refresh)
  if (next) await store.write(next)
  else await store.clear()
  return next
}

/**
 * Единственная точка HTTP-обмена с Python backend.
 * Добавляет Bearer-токен и X-Tenant, при 401 один раз обновляет токен (с ротацией)
 * и повторяет запрос, переводит имена полей и разбирает согласованный формат ошибок.
 */
export async function apiRequest<TSchema extends z.ZodType>(
  path: string,
  { method = "GET", query, body, schema, auth, signal }: ApiRequestOptions<TSchema>
): Promise<z.infer<TSchema>> {
  const tokens = auth ? await auth.tokens.read() : null
  if (auth && !tokens) {
    throw new ApiError("unauthorized", "Нет токена доступа")
  }

  const request = (accessToken?: string) =>
    send(path, { method, query, body, accessToken, tenant: auth?.tenant, signal })

  let response = await request(tokens?.access)
  if (response.status === 401 && auth && auth.refreshOnUnauthorized !== false) {
    const refreshed = await refreshStoredTokens(auth.tokens)
    if (!refreshed) throw new ApiError("unauthorized", "Сессия истекла", { status: 401 })
    response = await request(refreshed.access)
  }

  const payload = await readJson(response)
  if (!response.ok) throw apiErrorFromResponse(response.status, payload)

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiError("invalid_response", `Ответ ${method} ${path} не соответствует схеме`, {
      status: response.status,
    })
  }
  return parsed.data
}
