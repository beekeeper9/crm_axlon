"use server"

import { isMockDataSource } from "@/config/env"
import { markRead } from "@/features/notifications/api/notifications-repository"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

/** Отметить прочитанным одно уведомление (id) или все (null). null — получилось; иначе сообщение */
export async function markNotificationsReadAction(notificationId: string | null): Promise<string | null> {
  if (isMockDataSource) return "В демо-режиме уведомлений нет."
  try {
    await markRead(await getActionAuth(), notificationId)
    return null
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    return apiErrorMessage(error)
  }
}
