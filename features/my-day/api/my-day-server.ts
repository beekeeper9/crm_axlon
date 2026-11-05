import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { getRenderAuth } from "@/lib/auth/token-store"
import { companyDateOf } from "@/lib/datetime"

/**
 * «Мой день» через backend: рабочая смена и счётчики дел на сегодня. Месяц менеджера
 * (оборот, заработок, продукты) — в `my-month.ts`.
 */

export const workSessionSchema = z.object({
  id: z.string(),
  status: z.string(),
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }).nullable(),
  durationSeconds: z.int().nullable(),
})

export type WorkSession = z.infer<typeof workSessionSchema>

export type ServerDay = {
  today: string
  session: WorkSession | null
  tasksToday: number
  tasksOverdue: number
  meetingsToday: number
}

const countSchema = z.object({ count: z.int().nonnegative() })

function count(auth: ApiAuth, path: string, query: Record<string, string>): Promise<number> {
  return apiRequest(path, { auth, query: { ...query, limit: 1 }, schema: countSchema }).then((page) => page.count)
}

export async function fetchServerDay(userId: string): Promise<ServerDay> {
  const auth = await getRenderAuth()
  const today = companyDateOf(new Date().toISOString())
  const [current, tasksToday, tasksOverdue, meetingsToday] = await Promise.all([
    apiRequest("/api/v1/work-sessions/current/", { auth, schema: z.object({ session: workSessionSchema.nullable() }) }),
    count(auth, "/api/v1/activities/", { kind: "task", assigneeId: userId, taskStatus: "open", dueFrom: today, dueTo: today }),
    count(auth, "/api/v1/activities/", { kind: "task", assigneeId: userId, taskStatus: "open", overdue: "true" }),
    count(auth, "/api/v1/meetings/", { ownerId: userId, dateFrom: today, dateTo: today }),
  ])
  return {
    today,
    session: current.session,
    tasksToday,
    tasksOverdue,
    meetingsToday,
  }
}

/** `POST /work-sessions/start|stop/` — 409, если смена уже идёт или не начата */
export function toggleWorkSession(auth: ApiAuth, action: "start" | "stop"): Promise<WorkSession> {
  return apiRequest(`/api/v1/work-sessions/${action}/`, { method: "POST", auth, schema: workSessionSchema })
}
