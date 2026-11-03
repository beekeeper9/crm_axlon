"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { createWebFormKey, revokeWebFormKey, type WebFormKey } from "@/features/web-forms/api/web-forms-repository"
import { WEB_FORMS_PATH } from "@/features/web-forms/lib/path"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

export type WebFormActionResult = { ok: true; key: WebFormKey } | { ok: false; message: string }

const DEMO_MESSAGE = "В демо-режиме формы сайта не работают: нужен подключённый сервер."

const createSchema = z.object({
  name: z.string().trim().min(1, "Укажите название, например «Сайт»").max(100, "Название — не длиннее 100 символов"),
  departmentId: z.string().min(1, "Выберите отдел"),
})

function failure(error: unknown): { ok: false; message: string } {
  if (!(error instanceof ApiError)) throw error
  if (error.kind === "forbidden" && (!error.code || error.code === "access_denied")) return { ok: false, message: "Управлять формами можно только своего отдела." }
  if (error.kind === "not_found") return { ok: false, message: "Отдел или ключ не найден — обновите страницу." }
  if (error.kind === "conflict") return { ok: false, message: "В отделе слишком много активных ключей — отзовите неиспользуемый." }
  return { ok: false, message: apiErrorMessage(error) }
}

/** Новый ключ для формы сайта отдела */
export async function createWebFormKeyAction(input: z.input<typeof createSchema>): Promise<WebFormActionResult> {
  if (isMockDataSource) return { ok: false, message: DEMO_MESSAGE }
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте название" }
  try {
    const key = await createWebFormKey(await getActionAuth(), parsed.data)
    revalidatePath(WEB_FORMS_PATH)
    return { ok: true, key }
  } catch (error) {
    return failure(error)
  }
}

/** Отзыв ключа: форма на сайте сразу перестаёт принимать заявки */
export async function revokeWebFormKeyAction(keyId: string): Promise<WebFormActionResult> {
  if (isMockDataSource) return { ok: false, message: DEMO_MESSAGE }
  if (!keyId) return { ok: false, message: "Ключ не выбран" }
  try {
    const key = await revokeWebFormKey(await getActionAuth(), keyId)
    revalidatePath(WEB_FORMS_PATH)
    return { ok: true, key }
  } catch (error) {
    return failure(error)
  }
}
