import { NextResponse, type NextRequest } from "next/server"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { exchangeRefreshToken } from "@/lib/api/client"
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  TENANT_COOKIE,
  isAccessTokenFresh,
  tokenCookieOptions,
} from "@/lib/auth/cookies"
import { DEMO_SESSION_COOKIE } from "@/lib/session/demo-session"

/**
 * Демо-режим: без демо-сессии — на страницу входа.
 * Режим api, перед рендером страницы:
 * - без refresh-токена — на страницу входа;
 * - access истёк или скоро истечёт — обмен refresh-токена с ротацией. Новая пара
 *   уходит и в браузер (Set-Cookie), и в текущий запрос, чтобы страница сразу работала с ней.
 *   Во время рендера серверных компонентов записать cookie уже нельзя, поэтому обновление здесь;
 * - компания не выбрана — на выбор компании.
 * Права здесь не проверяются: это делает backend на каждом запросе.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isLoginPage = pathname === routes.login

  // Демо-режим: без демо-сессии — на вход. Действительность сессии и роль проверяет сервер страницы
  if (isMockDataSource) {
    if (isLoginPage || request.cookies.has(DEMO_SESSION_COOKIE)) return NextResponse.next()
    return redirectToLogin(request, `${pathname}${search}`)
  }

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value

  if (!refresh) {
    return isLoginPage ? NextResponse.next() : redirectToLogin(request, `${pathname}${search}`)
  }
  if (isLoginPage) return NextResponse.next()

  let response: NextResponse | null = null
  if (!isAccessTokenFresh(request.cookies.get(ACCESS_COOKIE)?.value)) {
    const tokens = await exchangeRefreshToken(refresh)
    if (!tokens) {
      const toLogin = redirectToLogin(request, `${pathname}${search}`, "expired")
      for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, TENANT_COOKIE]) toLogin.cookies.delete(name)
      return toLogin
    }
    request.cookies.set(ACCESS_COOKIE, tokens.access)
    request.cookies.set(REFRESH_COOKIE, tokens.refresh)
    response = NextResponse.next({ request: { headers: request.headers } })
    response.cookies.set(ACCESS_COOKIE, tokens.access, tokenCookieOptions(tokens.access))
    response.cookies.set(REFRESH_COOKIE, tokens.refresh, tokenCookieOptions(tokens.refresh))
  }

  if (!request.cookies.get(TENANT_COOKIE)?.value && pathname !== routes.selectCompany) {
    const toCompany = NextResponse.redirect(new URL(routes.selectCompany, request.url))
    // Новые токены нужно сохранить и при перенаправлении
    response?.cookies.getAll().forEach((cookie) => toCompany.cookies.set(cookie))
    return toCompany
  }

  return response ?? NextResponse.next()
}

function redirectToLogin(request: NextRequest, returnTo: string, reason?: "expired"): NextResponse {
  const url = new URL(routes.login, request.url)
  if (returnTo !== "/") url.searchParams.set("next", returnTo)
  if (reason) url.searchParams.set("reason", reason)
  return NextResponse.redirect(url)
}

export const config = {
  // Статика, картинки и файлы с расширением проходят без проверки
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
}
