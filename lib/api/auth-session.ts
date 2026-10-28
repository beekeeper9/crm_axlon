/**
 * Контекст авторизации для запросов к Python backend (согласовано: JWT Bearer).
 * Клиент зависит только от интерфейса хранилища. Реализация — httpOnly-cookie
 * сервера Next.js (lib/auth/token-store.ts, решение в docs/DECISIONS.md).
 */

export type TokenPair = {
  access: string
  refresh: string
}

export type TokenStore = {
  read(): Promise<TokenPair | null>
  /** Сохраняет новую пару. После ротации старый refresh-токен больше не используется. */
  write(tokens: TokenPair): Promise<void>
  clear(): Promise<void>
}

export type ApiAuth = {
  tokens: TokenStore
  /** Slug компании из `GET /api/v1/me/` → `memberships[].tenant`; уходит в заголовок `X-Tenant` */
  tenant?: string
  /**
   * Обновлять ли токен при 401. false — при рендере серверных компонентов: там нельзя записать
   * cookie, и ротированный refresh-токен потерялся бы. Токен заранее обновляет proxy.ts.
   */
  refreshOnUnauthorized?: boolean
}
