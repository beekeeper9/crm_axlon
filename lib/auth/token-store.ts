import { cookies } from "next/headers"

import type { ApiAuth, TokenPair, TokenStore } from "@/lib/api/auth-session"
import { ACCESS_COOKIE, REFRESH_COOKIE, TENANT_COOKIE, tokenCookieOptions } from "@/lib/auth/cookies"

async function readTokens(): Promise<TokenPair | null> {
  const store = await cookies()
  const access = store.get(ACCESS_COOKIE)?.value
  const refresh = store.get(REFRESH_COOKIE)?.value
  return access && refresh ? { access, refresh } : null
}

/** Для server actions: здесь cookie можно записать, поэтому обновление токена разрешено */
export const writableTokenStore: TokenStore = {
  read: readTokens,
  async write({ access, refresh }) {
    const store = await cookies()
    store.set(ACCESS_COOKIE, access, tokenCookieOptions(access))
    store.set(REFRESH_COOKIE, refresh, tokenCookieOptions(refresh))
  },
  async clear() {
    const store = await cookies()
    store.delete(ACCESS_COOKIE)
    store.delete(REFRESH_COOKIE)
    store.delete(TENANT_COOKIE)
  },
}

/** Для серверных компонентов: только чтение. Токен к этому моменту уже обновил proxy.ts */
const readOnlyTokenStore: TokenStore = {
  read: readTokens,
  async write() {
    throw new Error("Токены нельзя записать во время рендера страницы")
  },
  async clear() {
    // Удалить cookie во время рендера нельзя; при 401 proxy.ts или вход обновят их
  },
}

export async function readTenant(): Promise<string | undefined> {
  return (await cookies()).get(TENANT_COOKIE)?.value
}

/** Авторизация бизнес-запросов при рендере: Bearer + X-Tenant, без обновления токена */
export async function getRenderAuth(): Promise<ApiAuth> {
  return { tokens: readOnlyTokenStore, tenant: await readTenant(), refreshOnUnauthorized: false }
}

/** Авторизация в server actions: с обновлением и ротацией токена */
export async function getActionAuth(): Promise<ApiAuth> {
  return { tokens: writableTokenStore, tenant: await readTenant() }
}
