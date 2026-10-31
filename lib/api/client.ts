import { z } from "zod"

import { env } from "@/config/env"
import type { ApiAuth, TokenPair, TokenStore } from "@/lib/api/auth-session"
import { keysToCamel, keysToSnake } from "@/lib/api/case"
import { ApiError, apiErrorFromResponse, parseRetryAfter } from "@/lib/api/errors"

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
  passwordChange: "/api/v1/auth/password/change/",
} as const

const tokenPairSchema = z.object({ access: z.string(), refresh: z.string() })

function buildUrl(path: string, query?: Record<string, QueryValue>): URL {
  const baseUrl = env.API_BASE_URL
  if (!baseUrl) {
    throw new ApiError("network", "API_BASE_URL не задан")
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

/**
 * Итог обмена refresh-токена:
 * - `ok` — новая пара (старый refresh backend уже внёс в чёрный список);
 * - `rejected` — backend отклонил токен (истёк, отозван, уже использован): сессия закончена;
 * - `unavailable` — временная причина (нет связи, 429, 5xx): токен, возможно, ещё действителен,
 *   выходить из системы нельзя.
 */
export type RefreshResult =
  | { status: "ok"; tokens: TokenPair }
  | { status: "rejected" }
  | { status: "unavailable"; kind: "network" | "rate_limited" | "server" }

const refreshResults = new Map<string, Promise<RefreshResult>>()

/** 401 и 400 — токен недействителен; остальное (429, 5xx) не говорит о самом токене */
function isRefreshRejected(status: number): boolean {
  return status === 400 || status === 401
}

/**
 * Обменивает refresh-токен на новую пару (refresh ротируется).
 * Один обмен на один refresh-токен: параллельные запросы ждут общий результат,
 * иначе второй отправил бы уже недействительный токен и пользователя выбросило бы из системы.
 */
export function exchangeRefreshToken(refresh: string): Promise<RefreshResult> {
  const pending = refreshResults.get(refresh)
  if (pending) return pending

  const task = (async (): Promise<RefreshResult> => {
    try {
      const response = await send(AUTH_PATHS.refresh, { method: "POST", body: { refresh } })
      if (isRefreshRejected(response.status)) return { status: "rejected" }
      if (!response.ok) return { status: "unavailable", kind: response.status === 429 ? "rate_limited" : "server" }
      const parsed = tokenPairSchema.safeParse(await readJson(response))
      return parsed.success ? { status: "ok", tokens: parsed.data } : { status: "unavailable", kind: "server" }
    } catch {
      return { status: "unavailable", kind: "network" }
    }
  })()

  refreshResults.set(refresh, task)
  // Временную ошибку не запоминаем: следующий запрос должен попробовать снова
  void task.then((result) => {
    if (result.status === "unavailable") refreshResults.delete(refresh)
    else setTimeout(() => refreshResults.delete(refresh), REFRESH_REUSE_MS)
  })
  return task
}

/** null — токенов нет или backend отклонил refresh (локальные токены удалены) */
async function refreshStoredTokens(store: TokenStore): Promise<TokenPair | null> {
  const current = await store.read()
  if (!current) return null
  const result = await exchangeRefreshToken(current.refresh)
  if (result.status === "ok") {
    await store.write(result.tokens)
    return result.tokens
  }
  if (result.status === "unavailable") {
    throw new ApiError(result.kind, "Не удалось обновить сессию: сервер временно недоступен")
  }
  await store.clear()
  return null
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
  if (!response.ok) {
    throw apiErrorFromResponse(response.status, payload, parseRetryAfter(response.headers.get("Retry-After")))
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiError("invalid_response", `Ответ ${method} ${path} не соответствует схеме`, {
      status: response.status,
    })
  }
  return parsed.data
}
