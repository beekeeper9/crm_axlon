"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { updateCompanySettings } from "@/features/company-settings/api/company-settings"
import { COMPANY_SETTINGS_ROUTE } from "@/features/company-settings/lib/routes"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

/** null — сохранено; иначе сообщение и ошибки полей */
export type SettingsActionResult = { message: string; fieldErrors: Record<string, string> } | null

const BACKEND_MESSAGES: Array<[RegExp, string, string]> = [
  [/country must be/i, "country", "Код страны — две латинские буквы, например KG."],
  [/currency must be/i, "currency", "Код валюты — три латинские буквы, например KGS."],
  [/timezone must be/i, "timezone", "Выберите часовой пояс из списка."],
  [/^name\b/i, "name", "Укажите название компании (до 200 символов)."],
  [/morning_report_time/i, "morningReportTime", "Укажите время утреннего отчёта, например 09:00."],
  [/evening_report_time/i, "eveningReportTime", "Укажите время вечернего отчёта, например 19:00."],
]

const reportTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Время в формате ЧЧ:ММ, например 09:00")

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Укажите название компании").max(200, "Не длиннее 200 символов"),
  country: z.string().regex(/^[A-Z]{2}$/, "Выберите страну"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Выберите валюту"),
  timezone: z.string().min(1, "Выберите часовой пояс"),
  morningReportEnabled: z.boolean(),
  morningReportTime: reportTime,
  eveningReportEnabled: z.boolean(),
  eveningReportTime: reportTime,
})

export type SettingsInput = z.input<typeof settingsSchema>

/**
 * Настройки компании меняет директор; право проверяет и backend (`company.settings.manage`).
 * Передаются только изменённые поля — так журнал изменений показывает, что именно поменяли.
 */
export async function updateCompanySettingsAction(input: Partial<SettingsInput>): Promise<SettingsActionResult> {
  if (isMockDataSource) return { message: "В демо-режиме настройки компании на сервер не сохраняются.", fieldErrors: {} }
  if (!hasPermission((await getCurrentUser()).role, "company.settings")) {
    return { message: "Настройки компании меняет директор.", fieldErrors: {} }
  }
  const parsed = settingsSchema.partial().safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message
    return { message: "Проверьте поля формы.", fieldErrors }
  }
  try {
    await updateCompanySettings(await getActionAuth(), parsed.data)
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.kind !== "validation") return { message: apiErrorMessage(error), fieldErrors: {} }
    const known = BACKEND_MESSAGES.find(([pattern]) => pattern.test(error.message))
    return known ? { message: known[2], fieldErrors: { [known[1]]: known[2] } } : { message: error.message, fieldErrors: {} }
  }
  // Часовой пояс и валюта влияют на отчёты и формы всего приложения
  revalidatePath("/", "layout")
  revalidatePath(COMPANY_SETTINGS_ROUTE)
  return null
}
