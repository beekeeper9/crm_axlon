"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { fetchMe, logout, obtainTokens } from "@/lib/api/auth-api"
import type { TokenPair, TokenStore } from "@/lib/api/auth-session"
import { API_ERROR_MESSAGES, ApiError } from "@/lib/api/errors"
import { TENANT_COOKIE, tokenCookieOptions } from "@/lib/auth/cookies"
import { getActionAuth, writableTokenStore } from "@/lib/auth/token-store"

export type LoginState = {
  error: string | null
  /** request_id из ответа backend — пользователь может назвать его поддержке */
  requestId: string | null
  username: string
}

const credentialsSchema = z.object({
  username: z.string().trim().min(1, "Введите логин"),
  password: z.string().min(1, "Введите пароль"),
})

/** Возврат только на свою страницу: защита от перенаправления на чужой сайт */
function safeReturnPath(value: FormDataEntryValue | null): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : routes.myDay
}

function loginErrorMessage(error: unknown): { message: string; requestId: string | null } {
  if (!(error instanceof ApiError)) return { message: API_ERROR_MESSAGES.server, requestId: null }
  const message =
    error.kind === "unauthorized" || error.kind === "validation"
      ? "Неверный логин или пароль."
      : API_ERROR_MESSAGES[error.kind]
  return { message, requestId: error.requestId ?? null }
}

function fixedTokenStore(tokens: TokenPair): TokenStore {
  return { read: async () => tokens, write: async () => {}, clear: async () => {} }
}

async function setTenant(slug: string): Promise<void> {
  ;(await cookies()).set(TENANT_COOKIE, slug, tokenCookieOptions())
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "")
  if (isMockDataSource) return { error: "В демо-режиме вход не нужен.", requestId: null, username }

  const parsed = credentialsSchema.safeParse({ username, password: formData.get("password") })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля", requestId: null, username }
  }

  let destination: string
  try {
    const tokens = await obtainTokens(parsed.data)
    await writableTokenStore.write(tokens)
    // Только что полученная пара свежая — читаем её напрямую, а не из cookie текущего запроса
    const me = await fetchMe({ tokens: fixedTokenStore(tokens), refreshOnUnauthorized: false })
    const next = safeReturnPath(formData.get("next"))

    if (me.memberships.length === 0) {
      await writableTokenStore.clear()
      return { error: "У этой учётной записи нет доступа ни к одной компании.", requestId: null, username }
    }
    if (me.memberships.length === 1) {
      await setTenant(me.memberships[0].tenant)
      destination = next
    } else {
      destination = `${routes.selectCompany}?next=${encodeURIComponent(next)}`
    }
  } catch (error) {
    const { message, requestId } = loginErrorMessage(error)
    return { error: message, requestId, username }
  }
  redirect(destination)
}

/** Выбор компании проверяется по списку членств из /me/, а не верится на слово */
export async function selectCompany(formData: FormData): Promise<void> {
  if (isMockDataSource) redirect(routes.myDay)
  const slug = formData.get("tenant")
  const me = await fetchMe(await getActionAuth())
  const membership = me.memberships.find((item) => item.tenant === slug)
  if (!membership) redirect(routes.selectCompany)
  await setTenant(membership.tenant)
  redirect(safeReturnPath(formData.get("next")))
}

export async function signOut(): Promise<void> {
  if (isMockDataSource) redirect(routes.myDay)
  try {
    await logout(await getActionAuth())
  } catch {
    // Сессия на backend могла уже истечь — локальные токены всё равно удалены
  }
  redirect(routes.login)
}
