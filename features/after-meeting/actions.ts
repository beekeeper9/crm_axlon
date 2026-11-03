"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { leadRoute, routes } from "@/config/routes"
import { afterMeetingFormSchema, type AfterMeetingFormValues } from "@/features/after-meeting/schemas"
import { recordMeetingOutcome } from "@/features/meetings/api/meetings-repository"
import { updateDeal } from "@/features/sales/api/deal-mutations"
import { createDealTask } from "@/features/tasks/api/tasks-repository"
import { apiRequest } from "@/lib/api/client"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"
import { companyWallTimeToIso } from "@/lib/datetime"

/** Длительность перенесённой встречи — как у новой (в форме её нет) */
const DURATION_MINUTES = 60

const dealVersionSchema = z.object({ title: z.string(), amount: z.string(), nextStep: z.string().nullable(), expectedCloseDate: z.string().nullable(), version: z.int() })

/**
 * Обработка после встречи через существующие endpoint: итог встречи (если не записан),
 * задача следующего шага по сделке и сам следующий шаг в карточке сделки. Это три запроса,
 * а не одна транзакция: при ошибке на втором шаге итог уже сохранён — сообщение говорит об этом.
 */
export async function processAfterMeetingAction(
  target: { meetingId: string; dealId: string },
  input: AfterMeetingFormValues
): Promise<string | null> {
  if (isMockDataSource) return "В демо-режиме обработка на сервер не отправляется."
  const parsed = afterMeetingFormSchema.safeParse(input)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Проверьте поля"
  const values = parsed.data
  const auth = await getActionAuth()
  const note = [values.summary, values.agreements && `Договорённости: ${values.agreements}`].filter(Boolean).join("\n")
  let outcomeSaved = false
  // «Состоялась» и следующий шаг уходят одним запросом: backend создаёт задачу вместе с итогом
  const stepWithOutcome = values.needsResult && values.result === "held" && values.nextTitle.length > 0
  try {
    if (values.needsResult && values.result) {
      await recordMeetingOutcome(auth, target.meetingId, {
        result: values.result,
        newStart: values.result === "rescheduled" && values.rescheduledTo ? companyWallTimeToIso(values.rescheduledTo) : null,
        durationMinutes: DURATION_MINUTES,
        comment: note || null,
        nextStep: stepWithOutcome ? { title: values.nextTitle, dueDate: values.nextDueAt.slice(0, 10) } : null,
      })
      outcomeSaved = true
    }
    if (values.nextTitle && !stepWithOutcome) {
      await createDealTask(auth, target.dealId, {
        title: values.nextTitle,
        dueDate: values.nextDueAt.slice(0, 10),
        type: "todo",
        priority: "normal",
        assigneeId: null,
        description: values.agreements || null,
      })
    }
    if (values.nextTitle) {
      const deal = await apiRequest(`/api/v1/sales/deals/${encodeURIComponent(target.dealId)}/`, { auth, schema: dealVersionSchema })
      await updateDeal(
        auth,
        target.dealId,
        { title: deal.title, amount: deal.amount, nextStep: values.nextTitle, expectedCloseDate: deal.expectedCloseDate },
        deal.version
      )
    }
    revalidatePath(routes.afterMeeting)
    revalidatePath(leadRoute(target.dealId))
    return null
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    const message =
      error.code === "next_step_required"
        ? "После состоявшейся встречи нужен следующий шаг: заполните задачу и срок."
        : error.kind === "conflict" && values.nextTitle
          ? "У сделки уже две открытые задачи — выполните одну, чтобы поставить следующий шаг."
          : apiErrorMessage(error)
    return outcomeSaved ? `Итог встречи сохранён, но следующий шаг — нет: ${message}` : message
  }
}
