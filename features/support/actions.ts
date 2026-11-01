"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { TICKET_KINDS } from "@/features/platform/schemas"
import { sendTicket } from "@/features/support/api"
import { API_ERROR_MESSAGES, ApiError } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

const ticketFormSchema = z.object({
  kind: z.enum(TICKET_KINDS),
  subject: z.string().trim().min(3, "Не короче 3 символов").max(200, "Не длиннее 200 символов"),
  body: z.string().trim().min(5, "Опишите подробнее").max(5000, "Не длиннее 5000 символов"),
})

export type SendTicketResult = { ok: true } | { ok: false; message: string; fieldErrors: Record<string, string>; requestId: string | null }

/** Обращение уходит администратору платформы; привязка к компании и автору — на сервере, по токену */
export async function sendTicketAction(input: z.input<typeof ticketFormSchema>): Promise<SendTicketResult> {
  if (isMockDataSource) return { ok: false, message: "В демо-режиме обращения не отправляются.", fieldErrors: {}, requestId: null }
  const parsed = ticketFormSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message
    return { ok: false, message: "Проверьте поля формы.", fieldErrors, requestId: null }
  }
  try {
    await sendTicket(await getActionAuth(), parsed.data)
    revalidatePath(routes.support)
    return { ok: true }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    return { ok: false, message: API_ERROR_MESSAGES[error.kind], fieldErrors: {}, requestId: error.requestId ?? null }
  }
}
