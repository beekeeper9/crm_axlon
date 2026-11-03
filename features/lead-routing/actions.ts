"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { saveLeadRouting } from "@/features/lead-routing/api/lead-routing-repository"
import { LEAD_ROUTING_PATH } from "@/features/lead-routing/lib/path"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

const inputSchema = z.object({
  enabled: z.boolean(),
  memberIds: z.array(z.string().min(1)).refine((ids) => new Set(ids).size === ids.length, "Менеджер указан дважды"),
  requireOnShift: z.boolean(),
  skipOnAbsence: z.boolean(),
  isCompanyIntake: z.boolean().optional(),
})

/** null — сохранено; иначе сообщение для пользователя */
export async function saveLeadRoutingAction(departmentId: string, input: z.input<typeof inputSchema>): Promise<string | null> {
  if (isMockDataSource) return "В демо-режиме распределение не сохраняется."
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Проверьте настройки"
  try {
    await saveLeadRouting(await getActionAuth(), departmentId, parsed.data)
    revalidatePath(LEAD_ROUTING_PATH)
    return null
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.kind === "forbidden" && !error.code) return "Настраивать можно только распределение своего отдела; отдел для лидов без отдела выбирает директор."
    if (error.kind === "not_found") return "Отдел не найден — обновите страницу."
    if (error.kind === "validation") return "В списке есть сотрудник, который не является активным менеджером отдела. Обновите страницу."
    return apiErrorMessage(error)
  }
}
