"use server"

import { revalidatePath } from "next/cache"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import {
  cancelMeeting,
  confirmMeeting,
  createMeeting,
  recordMeetingOutcome,
  rescheduleMeeting,
} from "@/features/meetings/api/meetings-repository"
import { meetingFormSchema, meetingOutcomeFormSchema, type MeetingFormValues, type MeetingOutcomeFormValues } from "@/features/meetings/schemas"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"
import { companyWallTimeToIso } from "@/lib/datetime"

/** null — сохранено; иначе сообщение для пользователя */
export type MeetingActionResult = string | null

/** Длительность новой и перенесённой встречи: в форме её нет, backend требует время окончания */
const DEFAULT_DURATION_MINUTES = 60

const DEMO_ONLY = "В демо-режиме встречи на сервер не отправляются."

function failure(error: unknown, subject: "create" | "outcome" | "change"): MeetingActionResult {
  if (!(error instanceof ApiError)) throw error
  const messages: Partial<Record<ApiError["kind"], string>> = {
    conflict:
      subject === "create"
        ? "Время занято: у ведущего уже есть встреча в этот интервал."
        : subject === "change"
          ? "Встреча уже изменилась или закрыта. Обновите страницу."
          : "Итог уже записан или встреча изменилась. Обновите страницу.",
    not_found: subject === "create" ? "Сделка недоступна: возможно, её передали другому сотруднику." : "Встреча недоступна.",
    forbidden: "У вашей роли нет права на это действие.",
    validation: subject === "create" ? "Сервер не принял встречу: проверьте дату и ведущего." : "Сервер не принял итог: проверьте новую дату.",
  }
  const byCode = error.code === "subscription_inactive" || error.code === "feature_not_in_plan"
  const message = byCode ? apiErrorMessage(error) : (messages[error.kind] ?? apiErrorMessage(error))
  return error.requestId ? `${message} Код запроса: ${error.requestId}` : message
}

export async function createMeetingAction(values: MeetingFormValues, dealTitle: string): Promise<MeetingActionResult> {
  if (isMockDataSource) return DEMO_ONLY
  const parsed = meetingFormSchema.safeParse(values)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Проверьте поля"
  try {
    await createMeeting(await getActionAuth(), {
      dealId: parsed.data.leadId,
      title: `Встреча: ${dealTitle}`.slice(0, 200),
      startsAt: companyWallTimeToIso(parsed.data.startsAt),
      durationMinutes: DEFAULT_DURATION_MINUTES,
      format: parsed.data.format,
      location: parsed.data.format === "online" ? null : parsed.data.location || null,
      hostId: parsed.data.hostId,
      notes: parsed.data.notes || null,
    })
    revalidatePath(routes.meetings)
    return null
  } catch (error) {
    return failure(error, "create")
  }
}

export async function recordMeetingOutcomeAction(meetingId: string, values: MeetingOutcomeFormValues): Promise<MeetingActionResult> {
  if (isMockDataSource) return DEMO_ONLY
  const parsed = meetingOutcomeFormSchema.safeParse(values)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Проверьте поля"
  try {
    await recordMeetingOutcome(await getActionAuth(), meetingId, {
      result: parsed.data.result,
      // Перенос без новой даты — явное состояние «перенос без даты», оно попадает в хвосты CRM
      newStart: parsed.data.result === "rescheduled" && parsed.data.rescheduledTo ? companyWallTimeToIso(parsed.data.rescheduledTo) : null,
      durationMinutes: DEFAULT_DURATION_MINUTES,
      comment: parsed.data.comment || null,
    })
    revalidatePath(routes.meetings)
    return null
  } catch (error) {
    return failure(error, "outcome")
  }
}

async function change(operation: () => Promise<void>): Promise<MeetingActionResult> {
  if (isMockDataSource) return DEMO_ONLY
  try {
    await operation()
    revalidatePath(routes.meetings)
    return null
  } catch (error) {
    return failure(error, "change")
  }
}

export async function confirmMeetingAction(meetingId: string): Promise<MeetingActionResult> {
  return change(async () => confirmMeeting(await getActionAuth(), meetingId))
}

/** Новая дата и время («стенное» время компании из формы) */
export async function rescheduleMeetingAction(meetingId: string, startsAt: string): Promise<MeetingActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt)) return "Укажите новую дату и время"
  return change(async () => rescheduleMeeting(await getActionAuth(), meetingId, companyWallTimeToIso(startsAt), DEFAULT_DURATION_MINUTES))
}

export async function cancelMeetingAction(meetingId: string, reason: string): Promise<MeetingActionResult> {
  const trimmed = reason.trim()
  if (trimmed.length < 3) return "Укажите причину отмены"
  return change(async () => cancelMeeting(await getActionAuth(), meetingId, trimmed.slice(0, 500)))
}
