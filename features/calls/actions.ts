"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { leadRoute, routes } from "@/config/routes"
import { linkCall, logCall, type CallSubject } from "@/features/calls/api/calls-repository"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"
import { companyWallTimeToIso } from "@/lib/datetime"

/** null — записано; иначе сообщение для пользователя */
export type CallActionResult = string | null

const E164 = /^\+[1-9]\d{6,14}$/
const phone = (label: string) =>
  z
    .string()
    .transform((value) => value.replace(/[\s()-]/g, ""))
    .refine((value) => E164.test(value), `${label}: в формате +996555123456`)

const callLogSchema = z.object({
  direction: z.enum(["inbound", "outbound"]),
  clientPhone: phone("Номер клиента"),
  linePhone: phone("Номер компании"),
  status: z.enum(["completed", "missed", "failed"]),
  /** Время компании из <input type="datetime-local"> */
  startedAt: z.string().min(1, "Укажите, когда был звонок"),
  durationMinutes: z.coerce.number().int().min(0).max(600),
  durationSeconds: z.coerce.number().int().min(0).max(59),
  notes: z.string().trim().max(2000, "Не длиннее 2000 символов"),
})

const subjectSchema = z.object({ type: z.enum(["deal", "customer"]), id: z.string().min(1) }).nullable()

export type CallLogInput = z.input<typeof callLogSchema>

function failure(error: unknown, validation: string): CallActionResult {
  if (!(error instanceof ApiError)) throw error
  const message =
    error.kind === "validation"
      ? validation
      : error.kind === "not_found"
        ? "Сделка или клиент недоступны: возможно, их передали другому сотруднику."
        : apiErrorMessage(error)
  return error.requestId ? `${message} Код запроса: ${error.requestId}` : message
}

/**
 * Записать уже состоявшийся звонок; subject — сделка или клиент, из карточки которых его записывают.
 * Номера и права окончательно проверяет backend; пропущенный звонок он сам превращает в задачу «перезвонить».
 */
export async function logCallAction(input: CallLogInput, subject: CallSubject | null = null): Promise<CallActionResult> {
  if (isMockDataSource) return "В демо-режиме звонки на сервер не отправляются."
  const parsed = callLogSchema.safeParse(input)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Проверьте поля"
  const link = subjectSchema.safeParse(subject)
  if (!link.success) return "Не удалось определить сделку или клиента"
  const data = parsed.data
  const inbound = data.direction === "inbound"
  try {
    await logCall(await getActionAuth(), {
      direction: data.direction,
      fromNumber: inbound ? data.clientPhone : data.linePhone,
      toNumber: inbound ? data.linePhone : data.clientPhone,
      status: data.status,
      startedAt: companyWallTimeToIso(data.startedAt),
      durationSeconds: data.status === "completed" ? data.durationMinutes * 60 + data.durationSeconds : 0,
      notes: data.notes || null,
      subject: link.data,
    })
    revalidatePath(routes.calls)
    if (link.data?.type === "deal") revalidatePath(leadRoute(link.data.id))
    return null
  } catch (error) {
    return failure(error, "Сервер не принял звонок: проверьте номера, время и длительность.")
  }
}

/** Привязать звонок к клиенту или сделке (null — отвязать) */
export async function linkCallAction(callId: string, subject: CallSubject | null): Promise<CallActionResult> {
  if (isMockDataSource) return "В демо-режиме звонки на сервер не отправляются."
  const link = subjectSchema.safeParse(subject)
  if (!link.success) return "Не удалось определить сделку или клиента"
  try {
    await linkCall(await getActionAuth(), callId, link.data)
    revalidatePath(routes.calls)
    return null
  } catch (error) {
    return failure(error, "Сервер не принял привязку.")
  }
}
