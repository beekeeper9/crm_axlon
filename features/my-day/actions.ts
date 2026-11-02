"use server"

import { revalidatePath } from "next/cache"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { toggleWorkSession } from "@/features/my-day/api/my-day-server"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

/** null — получилось; иначе сообщение для пользователя */
export async function workSessionAction(action: "start" | "stop"): Promise<string | null> {
  if (isMockDataSource) return "В демо-режиме смена не отмечается."
  try {
    await toggleWorkSession(await getActionAuth(), action)
    revalidatePath(routes.myDay)
    return null
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.kind === "conflict") return action === "start" ? "Смена уже идёт. Обновите страницу." : "Смена не начата. Обновите страницу."
    return apiErrorMessage(error)
  }
}
