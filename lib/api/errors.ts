import { z } from "zod"

export type ApiErrorKind =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "not_found"
  /** 409: запись изменили параллельно (version) или переход недопустим в текущем состоянии */
  | "conflict"
  /** 429: ограничение частоты запросов или временная блокировка входа */
  | "rate_limited"
  | "server"
  /** Ответ backend не совпал с ожидаемой схемой */
  | "invalid_response"
  /** Endpoint ещё не согласован с backend — см. docs/API_CONTRACT.md */
  | "contract_pending"

/** Ошибки валидации по полям (формат DRF), имена полей уже в camelCase */
export type FieldErrors = Record<string, string[]>

type ApiErrorOptions = {
  status?: number
  /** `error.code` из ответа backend, например `validation_error` */
  code?: string
  /** `error.request_id` — показываем пользователю, чтобы поддержка нашла запрос в логах */
  requestId?: string
  fieldErrors?: FieldErrors
  /** Через сколько секунд можно повторить (заголовок Retry-After), если сервер его прислал */
  retryAfterSeconds?: number
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code?: string
  readonly requestId?: string
  readonly fieldErrors?: FieldErrors
  readonly retryAfterSeconds?: number

  constructor(kind: ApiErrorKind, message: string, options: ApiErrorOptions = {}) {
    super(message)
    this.name = "ApiError"
    this.kind = kind
    this.status = options.status
    this.code = options.code
    this.requestId = options.requestId
    this.fieldErrors = options.fieldErrors
    this.retryAfterSeconds = options.retryAfterSeconds
  }
}

export function errorKindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized"
  if (status === 403) return "forbidden"
  if (status === 404) return "not_found"
  if (status === 409) return "conflict"
  if (status === 429) return "rate_limited"
  if (status === 400 || status === 422) return "validation"
  return "server"
}

/**
 * Согласованное тело ошибки backend (уже после преобразования в camelCase):
 * `{ error: { code, message, details?, requestId } }`.
 */
const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
})

/** DRF: `{ field: ["сообщение"] }`; вложенные структуры не разворачиваем */
function toFieldErrors(details: unknown): FieldErrors | undefined {
  if (details === null || typeof details !== "object" || Array.isArray(details)) return undefined
  const entries = Object.entries(details).flatMap(([field, messages]) =>
    Array.isArray(messages) && messages.every((message) => typeof message === "string")
      ? [[field, messages] as const]
      : []
  )
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/** Retry-After в секундах; форму с датой backend не использует */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : undefined
}

export function apiErrorFromResponse(status: number, payload: unknown, retryAfterSeconds?: number): ApiError {
  const parsed = errorEnvelopeSchema.safeParse(payload)
  if (!parsed.success) {
    return new ApiError(errorKindFromStatus(status), `API ответил статусом ${status}`, { status, retryAfterSeconds })
  }

  const { code, message, details, requestId } = parsed.data.error
  const kind = code === "validation_error" ? "validation" : errorKindFromStatus(status)
  return new ApiError(kind, message, {
    status,
    code,
    requestId,
    fieldErrors: kind === "validation" ? toFieldErrors(details) : undefined,
    retryAfterSeconds,
  })
}

/** Сообщения для пользователя: без технических подробностей. */
export const API_ERROR_MESSAGES: Record<ApiErrorKind, string> = {
  network: "Нет связи с сервером. Проверьте подключение к интернету.",
  unauthorized: "Сессия истекла. Войдите снова.",
  forbidden: "У вас нет доступа к этим данным.",
  validation: "Данные заполнены с ошибками.",
  not_found: "Данные не найдены.",
  conflict: "Данные уже изменились. Обновите страницу и повторите действие.",
  rate_limited: "Слишком много запросов. Подождите немного и повторите.",
  server: "Сервер временно недоступен. Попробуйте позже.",
  invalid_response: "Сервер вернул данные в неожиданном формате.",
  contract_pending: "Этот раздел ещё не подключён к серверу.",
}

/**
 * Для API-реализаций, чей endpoint ещё не согласован с backend.
 * Честно сообщает об этом вместо выдуманного запроса.
 */
export function contractPending(operation: string): never {
  throw new ApiError("contract_pending", `API-контракт не согласован: ${operation}`)
}
