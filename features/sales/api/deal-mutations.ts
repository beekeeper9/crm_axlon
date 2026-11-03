import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"

/**
 * Изменения сделки через backend (`/sales/deals/…`). Правила (лимиты, обязательная причина
 * отказа, «выигрыш только с оплатой», права по роли и отделу) проверяет сервер; конфликт
 * версии — 409, и интерфейс не затирает чужие правки.
 */

const dealRefSchema = z.object({ id: z.string(), version: z.int() })

const path = (dealId: string, action = "") => `/api/v1/sales/deals/${encodeURIComponent(dealId)}/${action}`

export type NewDeal = {
  title: string
  amount: string
  pipelineId: string | null
  customerId: string | null
  nextStep: string | null
}

export async function createDeal(auth: ApiAuth, deal: NewDeal): Promise<string> {
  const created = await apiRequest("/api/v1/sales/deals/", {
    method: "POST",
    auth,
    body: {
      title: deal.title,
      amount: deal.amount,
      ...(deal.pipelineId ? { pipelineId: deal.pipelineId } : {}),
      ...(deal.customerId ? { customerId: deal.customerId } : {}),
      ...(deal.nextStep ? { nextStep: deal.nextStep } : {}),
    },
    schema: dealRefSchema,
  })
  return created.id
}

export type DealChanges = {
  title: string
  amount: string
  nextStep: string
  expectedCloseDate: string | null
  /** Откуда пришёл клиент; пустая строка очищает, без поля — не меняется */
  source?: string
}

/** `PATCH` с версией: если сделку успели изменить, backend ответит 409 */
export async function updateDeal(auth: ApiAuth, dealId: string, changes: DealChanges, version: number): Promise<void> {
  await apiRequest(path(dealId), {
    method: "PATCH",
    auth,
    body: { ...changes, version },
    schema: dealRefSchema,
  })
}

/** Следующий шаг — задача по сделке: без него backend не переводит сделку на другой рабочий этап */
export type NextStepInput = { title: string; dueDate: string; assigneeUserId?: string | null }

/** Что нужно некоторым переходам: новое время встречи («Встреча перенесена») и следующий шаг */
export type StageMoveExtras = {
  meetingStart?: string
  meetingEnd?: string
  nextStep?: NextStepInput
}

/**
 * Смена этапа; этап вида won/lost закрывает сделку (для lost backend требует причину).
 * «Продажа» здесь не выбирается: её ставит только подтверждённая оплата (409 sale_requires_payment).
 */
export async function moveDealStage(
  auth: ApiAuth,
  dealId: string,
  stageId: string,
  loss: { lossReasonId: string | null; reason: string } | null,
  extras: StageMoveExtras = {}
): Promise<void> {
  await apiRequest(path(dealId, "stage/"), {
    method: "POST",
    auth,
    body: {
      stageId,
      ...(loss?.lossReasonId ? { lossReasonId: loss.lossReasonId } : {}),
      ...(loss?.reason ? { reason: loss.reason } : {}),
      ...(extras.meetingStart && extras.meetingEnd ? { meetingStart: extras.meetingStart, meetingEnd: extras.meetingEnd } : {}),
      ...(extras.nextStep
        ? {
            nextStep: {
              title: extras.nextStep.title,
              dueDate: extras.nextStep.dueDate,
              ...(extras.nextStep.assigneeUserId ? { assigneeUserId: extras.nextStep.assigneeUserId } : {}),
            },
          }
        : {}),
    },
    schema: dealRefSchema,
  })
}

export async function reopenDeal(auth: ApiAuth, dealId: string): Promise<void> {
  await apiRequest(path(dealId, "reopen/"), { method: "POST", auth, schema: dealRefSchema })
}

export async function assignDeal(auth: ApiAuth, dealId: string, ownerUserId: string): Promise<void> {
  await apiRequest(path(dealId, "assign/"), { method: "POST", auth, body: { ownerUserId }, schema: dealRefSchema })
}
