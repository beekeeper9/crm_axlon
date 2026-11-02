"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { logCall } from "@/features/calls/api/calls-repository"
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

export type CallLogInput = z.input<typeof callLogSchema>

/** Записать уже состоявшийся звонок. Номера и права окончательно проверяет backend */
export async function logCallAction(input: CallLogInput): Promise<CallActionResult> {
  if (isMockDataSource) return "В демо-режиме звонки на сервер не отправляются."
  const parsed = callLogSchema.safeParse(input)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Проверьте поля"
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
    })
    revalidatePath(routes.calls)
    return null
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    const message = error.kind === "validation" ? "Сервер не принял звонок: проверьте номера, время и длительность." : apiErrorMessage(error)
    return error.requestId ? `${message} Код запроса: ${error.requestId}` : message
  }
}
