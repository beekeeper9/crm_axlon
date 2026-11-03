import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"

/**
 * ИИ-помощник (`/ai/agent/runs/`) — модуль backend другого разработчика, здесь только клиент.
 * Помощник предлагает действия; ничего не выполняется, пока пользователь не подтвердит
 * каждое. Запуск виден только тому, кто его сделал.
 */

export const actionSchema = z.object({
  index: z.int().nonnegative(),
  tool: z.string(),
  subjectRef: z.string().nullable().optional(),
  args: z.record(z.string(), z.unknown()).nullable().optional(),
  reason: z.string().nullable().optional(),
  status: z.enum(["proposed", "executed", "failed", "rejected"]),
  resultRef: z.string().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  decidedAt: z.iso.datetime({ offset: true }).nullable().optional(),
})

export const runSchema = z.object({
  id: z.string(),
  request: z.string(),
  status: z.enum(["pending", "submitted", "succeeded", "failed"]),
  summary: z.string().nullable(),
  actions: z.array(actionSchema),
  isMock: z.boolean(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  errorCode: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  finishedAt: z.iso.datetime({ offset: true }).nullable(),
})

export type AssistantRun = z.infer<typeof runSchema>
export type AssistantAction = z.infer<typeof actionSchema>

const runPath = (runId: string) => `/api/v1/ai/agent/runs/${encodeURIComponent(runId)}/`

export function startRun(auth: ApiAuth, request: string): Promise<AssistantRun> {
  return apiRequest("/api/v1/ai/agent/runs/", { method: "POST", auth, body: { request }, schema: runSchema })
}

export function getRun(auth: ApiAuth, runId: string): Promise<AssistantRun> {
  return apiRequest(runPath(runId), { auth, schema: runSchema })
}

export function decideAction(auth: ApiAuth, runId: string, index: number, decision: "confirm" | "reject"): Promise<AssistantAction> {
  return apiRequest(`${runPath(runId)}actions/${index}/${decision}/`, { method: "POST", auth, schema: actionSchema })
}
