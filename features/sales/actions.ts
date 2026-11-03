"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { leadRoute, routes } from "@/config/routes"
import {
  assignDeal,
  createDeal,
  moveDealStage,
  type StageMoveExtras,
  reopenDeal,
  updateDeal,
} from "@/features/sales/api/deal-mutations"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

export type DealActionResult<T = null> =
  | { ok: true; data: T }
  | {
      ok: false
      message: string
      requestId: string | null
      /** Код правила перехода: интерфейс дозапрашивает следующий шаг или дату встречи */
      code?: StageMoveRuleCode
    }

/** Правила перехода по этапам, на которые интерфейс отвечает формой, а не только текстом */
export type StageMoveRuleCode = "next_step_required" | "meeting_date_required" | "sale_requires_payment"

const STAGE_RULE_MESSAGES: Record<StageMoveRuleCode, string> = {
  next_step_required: "Запланируйте следующий шаг: задачу с названием и сроком.",
  meeting_date_required: "Укажите новую дату и время встречи.",
  sale_requires_payment: "«Продажа» ставится только после оплаты: внесите оплату с чеком — сделка закроется, когда её подтвердят.",
}

function isStageRuleCode(code: string | undefined | null): code is StageMoveRuleCode {
  return code === "next_step_required" || code === "meeting_date_required" || code === "sale_requires_payment"
}

const DEMO_ONLY = { ok: false as const, message: "В демо-режиме сделки на сервер не сохраняются.", requestId: null }

/** Ответы backend на английском → понятные сообщения */
const BACKEND_MESSAGES: Array<[RegExp, string]> = [
  [/payment/i, "Закрыть сделку успешно можно только после оплаты — внесите оплату во вкладке «Оплата»."],
  [/reason/i, "Укажите причину отказа."],
  [/closed|not open/i, "Сделка уже закрыта — сначала откройте её снова."],
  [/department|team/i, "Передать сделку можно только сотруднику своего отдела."],
]

function failure(error: unknown): DealActionResult<never> {
  if (!(error instanceof ApiError)) throw error
  const requestId = error.requestId ?? null
  if (error.code === "subscription_inactive" || error.code === "feature_not_in_plan") {
    return { ok: false, message: apiErrorMessage(error), requestId }
  }
  if (isStageRuleCode(error.code)) return { ok: false, message: STAGE_RULE_MESSAGES[error.code], requestId, code: error.code }
  if (error.code === "system_stage_locked") return { ok: false, message: "Это системный этап воронки: его нельзя изменить.", requestId }
  if (error.kind === "conflict" && /version|modified|changed/i.test(error.message)) {
    return { ok: false, message: "Сделку уже изменил кто-то другой. Обновите страницу и повторите.", requestId }
  }
  if (error.kind === "not_found") return { ok: false, message: "Сделка недоступна: возможно, её передали другому сотруднику.", requestId }
  if (error.kind === "forbidden") return { ok: false, message: "У вашей роли нет права на это действие со сделкой.", requestId }
  const known = BACKEND_MESSAGES.find(([pattern]) => pattern.test(error.message))
  return { ok: false, message: known?.[1] ?? apiErrorMessage(error), requestId }
}

async function run<T>(dealId: string | null, operation: () => Promise<T>): Promise<DealActionResult<T>> {
  if (isMockDataSource) return DEMO_ONLY
  try {
    const data = await operation()
    revalidatePath(routes.sales)
    if (dealId) revalidatePath(leadRoute(dealId))
    return { ok: true, data }
  } catch (error) {
    return failure(error)
  }
}

const amountSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, "").replace(",", "."))
  .refine((value) => /^\d{1,13}(\.\d{1,2})?$/.test(value), "Сумма — число, например 15000 или 15000.50")

const invalid = (error: z.ZodError) => ({ ok: false as const, message: error.issues[0]?.message ?? "Проверьте поля", requestId: null })

const newDealSchema = z.object({
  title: z.string().trim().min(2, "Укажите название сделки").max(200, "Не длиннее 200 символов"),
  amount: amountSchema,
  pipelineId: z.string().nullable(),
  nextStep: z.string().trim().max(300, "Не длиннее 300 символов"),
})

export async function createDealAction(input: z.input<typeof newDealSchema>): Promise<DealActionResult<string>> {
  const parsed = newDealSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return run(null, async () =>
    createDeal(await getActionAuth(), { ...parsed.data, customerId: null, nextStep: parsed.data.nextStep || null })
  )
}

const dealChangesSchema = z.object({
  title: z.string().trim().min(2, "Укажите название сделки").max(200, "Не длиннее 200 символов"),
  amount: amountSchema,
  nextStep: z.string().trim().max(300, "Не длиннее 300 символов"),
  expectedCloseDate: z.union([z.iso.date(), z.literal("")]),
  source: z.string().trim().max(100, "Источник — не длиннее 100 символов").optional(),
})

export async function updateDealAction(
  dealId: string,
  version: number,
  input: z.input<typeof dealChangesSchema>
): Promise<DealActionResult> {
  const parsed = dealChangesSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return run(dealId, async () => {
    await updateDeal(await getActionAuth(), dealId, { ...parsed.data, expectedCloseDate: parsed.data.expectedCloseDate || null }, version)
    return null
  })
}

const extrasSchema = z.object({
  meetingStart: z.iso.datetime({ offset: true }).optional(),
  meetingEnd: z.iso.datetime({ offset: true }).optional(),
  nextStep: z
    .object({
      title: z.string().trim().min(2, "Опишите следующий шаг").max(200, "Не длиннее 200 символов"),
      dueDate: z.iso.date("Укажите срок следующего шага"),
      assigneeUserId: z.string().nullable().optional(),
    })
    .optional(),
})

/**
 * Смена этапа; для этапа отказа нужна причина из справочника (комментарий — по желанию).
 * `extras` — новое время встречи для «Встреча перенесена» и следующий шаг для рабочего этапа.
 */
export async function moveDealStageAction(
  dealId: string,
  stageId: string,
  loss: { lossReasonId: string | null; comment: string } | null = null,
  extras: StageMoveExtras = {}
): Promise<DealActionResult> {
  const parsed = extrasSchema.safeParse(extras)
  if (!parsed.success) return invalid(parsed.error)
  return run(dealId, async () => {
    await moveDealStage(await getActionAuth(), dealId, stageId, loss && { lossReasonId: loss.lossReasonId, reason: loss.comment.trim() }, parsed.data)
    return null
  })
}

export async function reopenDealAction(dealId: string): Promise<DealActionResult> {
  return run(dealId, async () => {
    await reopenDeal(await getActionAuth(), dealId)
    return null
  })
}

export async function assignDealAction(dealId: string, ownerUserId: string): Promise<DealActionResult> {
  return run(dealId, async () => {
    await assignDeal(await getActionAuth(), dealId, ownerUserId)
    return null
  })
}
