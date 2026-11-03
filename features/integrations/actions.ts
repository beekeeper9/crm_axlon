"use server"

import { checkIntegration, integrationProviderSchema, type IntegrationCheck } from "@/features/integrations/api/integrations-repository"
import { API_ERROR_MESSAGES, ApiError } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

export type CheckActionResult = { ok: true; data: IntegrationCheck } | { ok: false; message: string }

/** Проверка подключения канала; право (директор) проверяет backend */
export async function checkIntegrationAction(provider: unknown): Promise<CheckActionResult> {
  const parsed = integrationProviderSchema.safeParse(provider)
  if (!parsed.success) return { ok: false, message: "Неизвестный канал" }
  try {
    return { ok: true, data: await checkIntegration(await getActionAuth(), parsed.data) }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    return { ok: false, message: API_ERROR_MESSAGES[error.kind] }
  }
}
