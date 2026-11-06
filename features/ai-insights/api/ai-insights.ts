import { cache } from "react"
import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { getRenderAuth } from "@/lib/auth/token-store"

/**
 * ИИ через backend CRM (`/ai/…`): браузер не знает ни адреса модели, ни ключей. Работа
 * асинхронная: `POST` ставит задачу (202, или 200 с прежним результатом, если данные не
 * менялись), `GET` читает последнюю; 404 — разбора ещё не просили. Результат проверяет backend.
 */

const statusSchema = z.object({ enabled: z.boolean(), canRequest: z.boolean() })

/**
 * Показывать ли блоки ИИ: подключена ли модель на сервере (`AI_PLATFORM_ENABLED`), есть ли ИИ
 * в тарифе и право у роли. Блоки необязательные: при отказе их просто нет на экране.
 */
export const fetchAiAvailable = cache(async (): Promise<boolean> => {
  try {
    const status = await apiRequest("/api/v1/ai/status/", { auth: await getRenderAuth(), schema: statusSchema })
    return status.enabled && status.canRequest
  } catch (error) {
    if (error instanceof ApiError) return false
    throw error
  }
})

const jobFields = {
  id: z.string(),
  status: z.enum(["pending", "submitted", "succeeded", "failed"]),
  isMock: z.boolean(),
  errorCode: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  finishedAt: z.iso.datetime({ offset: true }).nullable(),
}

const groundedSchema = z.object({ text: z.string(), evidenceQuote: z.string() })

/** `call_summary.output.v2` (и v1 без `insufficient_data`): цитаты проверены, `summary` — нет */
const callSummarySchema = z.object({
  ...jobFields,
  result: z
    .object({
      summary: z.string(),
      keyPoints: z.array(groundedSchema),
      nextStep: groundedSchema.nullable(),
      insufficientData: z.boolean().default(false),
    })
    .nullable(),
})

const pointSchema = z.object({ text: z.string() })

/** `deal_coach.output.v1` */
const dealBriefSchema = z.object({
  ...jobFields,
  result: z
    .object({
      situation: z.array(pointSchema),
      risks: z.array(pointSchema),
      questions: z.array(pointSchema),
      nextStep: pointSchema.nullable(),
      insufficientData: z.boolean(),
    })
    .nullable(),
})

export type CallSummary = z.infer<typeof callSummarySchema>
export type DealBrief = z.infer<typeof dealBriefSchema>

const callPath = (callId: string) => `/api/v1/ai/calls/${encodeURIComponent(callId)}/summary/`
const dealPath = (dealId: string) => `/api/v1/ai/deals/${encodeURIComponent(dealId)}/brief/`

/** Последний результат; null — его ещё не просили */
async function latest<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch (error) {
    if (error instanceof ApiError && error.kind === "not_found") return null
    throw error
  }
}

export function fetchCallSummary(auth: ApiAuth, callId: string): Promise<CallSummary | null> {
  return latest(() => apiRequest(callPath(callId), { auth, schema: callSummarySchema }))
}

export function requestCallSummary(auth: ApiAuth, callId: string): Promise<CallSummary> {
  return apiRequest(callPath(callId), { method: "POST", auth, schema: callSummarySchema })
}

export function fetchDealBrief(auth: ApiAuth, dealId: string): Promise<DealBrief | null> {
  return latest(() => apiRequest(dealPath(dealId), { auth, schema: dealBriefSchema }))
}

export function requestDealBrief(auth: ApiAuth, dealId: string): Promise<DealBrief> {
  return apiRequest(dealPath(dealId), { method: "POST", auth, body: {}, schema: dealBriefSchema })
}
