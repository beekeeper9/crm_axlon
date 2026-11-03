import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { PAGE_LIMIT_MAX, paginatedSchema } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { nowIso } from "@/lib/clock"
import { companyDateOf } from "@/lib/datetime"

/**
 * Рабочие смены сотрудников: `GET /work-sessions/` (РОП — свой отдел, директор — компания).
 * Смена начинается при входе в систему или кнопкой «Начать смену», заканчивается при выходе
 * или кнопкой «Завершить смену». Закрытие окна браузера отследить нельзя: незакрытую смену
 * backend через несколько часов помечает «конец не отмечен» (`unconfirmed`).
 */

export const workSessionStatusSchema = z.enum(["open", "closed", "unconfirmed"])

export const staffSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: workSessionStatusSchema,
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }).nullable(),
  durationSeconds: z.int().nullable(),
})

export type StaffSession = z.infer<typeof staffSessionSchema>

const sessionsPageSchema = paginatedSchema(staffSessionSchema)

export type SessionsQuery = { userId?: string; dateFrom: string; dateTo: string }

/** Все смены периода (по страницам) — сотрудника или всех в области пользователя */
export async function listWorkSessions(query: SessionsQuery, auth?: ApiAuth): Promise<StaffSession[]> {
  if (isMockDataSource) throw new ApiError("contract_pending", "В демо-режиме рабочие смены не ведутся")
  const authorization = auth ?? (await getRenderAuth())
  const all: StaffSession[] = []
  for (let page = 0; page < 20; page += 1) {
    const chunk = await apiRequest("/api/v1/work-sessions/", {
      auth: authorization,
      query: { ...query, limit: PAGE_LIMIT_MAX, offset: all.length },
      schema: sessionsPageSchema,
    })
    all.push(...chunk.results)
    if (all.length >= chunk.count || chunk.results.length === 0) break
  }
  return all
}

/** Начать или закончить свою смену; 409 (уже идёт / уже закрыта) — не ошибка для входа и выхода */
export async function toggleOwnSession(auth: ApiAuth, action: "start" | "stop"): Promise<void> {
  try {
    await apiRequest(`/api/v1/work-sessions/${action}/`, { method: "POST", auth, schema: z.unknown() })
  } catch (error) {
    if (error instanceof ApiError && error.kind === "conflict") return
    throw error
  }
}

/** Сегодня и N дней назад — дни компании (YYYY-MM-DD) */
export function companyDays(daysBack: number): { today: string; from: string } {
  const now = Date.parse(nowIso())
  return { today: companyDateOf(new Date(now).toISOString()), from: companyDateOf(new Date(now - daysBack * 86_400_000).toISOString()) }
}
