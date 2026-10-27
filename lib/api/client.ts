import type { z } from "zod"

import { env } from "@/config/env"
import { ApiError, errorKindFromStatus } from "@/lib/api/errors"

type QueryValue = string | number | boolean | undefined

export type ApiRequestOptions<TSchema extends z.ZodType> = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  query?: Record<string, QueryValue>
  body?: unknown
  /** Схема ответа: каждый ответ backend проверяется перед использованием. */
  schema: TSchema
  signal?: AbortSignal
}

function buildUrl(path: string, query?: Record<string, QueryValue>): URL {
  const baseUrl = env.NEXT_PUBLIC_API_BASE_URL
  if (!baseUrl) {
    throw new ApiError("network", "NEXT_PUBLIC_API_BASE_URL не задан")
  }

  const url = new URL(path, baseUrl)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return url
}

/**
 * Единственная точка HTTP-обмена с Python backend.
 * Способ авторизации (cookie или токен) ещё не согласован —
 * заголовки авторизации добавим сюда, когда он будет утверждён.
 */
export async function apiRequest<TSchema extends z.ZodType>(
  path: string,
  { method = "GET", query, body, schema, signal }: ApiRequestOptions<TSchema>
): Promise<z.infer<TSchema>> {
  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    throw new ApiError("network", "Не удалось выполнить запрос к API")
  }

  if (!response.ok) {
    throw new ApiError(
      errorKindFromStatus(response.status),
      `API ответил статусом ${response.status}`,
      response.status
    )
  }

  const payload: unknown = response.status === 204 ? null : await response.json()
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiError(
      "invalid_response",
      `Ответ ${method} ${path} не соответствует схеме`,
      response.status
    )
  }
  return parsed.data
}
