export type ApiErrorKind =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "not_found"
  | "server"
  /** Ответ backend не совпал с ожидаемой схемой */
  | "invalid_response"
  /** Endpoint ещё не согласован с backend — см. docs/API_CONTRACT.md */
  | "contract_pending"

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = "ApiError"
    this.kind = kind
    this.status = status
  }
}

export function errorKindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized"
  if (status === 403) return "forbidden"
  if (status === 404) return "not_found"
  if (status === 400 || status === 422) return "validation"
  return "server"
}

/** Сообщения для пользователя: без технических подробностей. */
export const API_ERROR_MESSAGES: Record<ApiErrorKind, string> = {
  network: "Нет связи с сервером. Проверьте подключение к интернету.",
  unauthorized: "Сессия истекла. Войдите снова.",
  forbidden: "У вас нет доступа к этим данным.",
  validation: "Данные заполнены с ошибками.",
  not_found: "Данные не найдены.",
  server: "Сервер временно недоступен. Попробуйте позже.",
  invalid_response: "Сервер вернул данные в неожиданном формате.",
  contract_pending: "Этот раздел ещё не подключён к серверу.",
}

/**
 * Для API-реализаций, чей endpoint ещё не согласован с backend.
 * Честно сообщает об этом вместо выдуманного запроса.
 */
export function contractPending(operation: string): never {
  throw new ApiError(
    "contract_pending",
    `API-контракт не согласован: ${operation}`
  )
}
