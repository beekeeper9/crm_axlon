"use server"

import { isMockDataSource } from "@/config/env"
import {
  markRead,
  savePreference,
  type NotificationPreferences,
  type PreferenceChange,
} from "@/features/notifications/api/notifications-repository"
import { MAX_REMINDER_DAYS_BEFORE, notificationCategorySchema } from "@/features/notifications/lib/categories"
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

export type PreferenceResult = { ok: true; preferences: NotificationPreferences } | { ok: false; message: string }

/** Включить/выключить категорию или задать, за сколько дней напоминать о сроке задачи */
export async function savePreferenceAction(change: PreferenceChange): Promise<PreferenceResult> {
  if (isMockDataSource) return { ok: false, message: "В демо-режиме настройки уведомлений не сохраняются." }
  if ("category" in change && !notificationCategorySchema.safeParse(change.category).success) {
    return { ok: false, message: "Неизвестная категория уведомлений." }
  }
  if ("reminderDaysBefore" in change) {
    const days = change.reminderDaysBefore
    if (!Number.isInteger(days) || days < 0 || days > MAX_REMINDER_DAYS_BEFORE) {
      return { ok: false, message: `Напоминание — от 0 до ${MAX_REMINDER_DAYS_BEFORE} дней до срока.` }
    }
  }
  try {
    return { ok: true, preferences: await savePreference(await getActionAuth(), change) }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    return { ok: false, message: apiErrorMessage(error) }
  }
}
