"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { commitImport, previewImport } from "@/features/imports/api/imports-repository"
import { importEntitySchema, type ImportJob, type ImportPreview } from "@/features/imports/schemas"
import { API_ERROR_MESSAGES, ApiError } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

export type ImportActionResult<T> = { ok: true; data: T } | { ok: false; message: string }

const requestSchema = z.object({
  entity: importEntitySchema,
  filename: z.string().min(1).max(255),
  content: z.string().min(1, "Файл пустой"),
  ownerUserId: z.string().nullable(),
})

/** Ошибки разбора файла backend пишет по-русски — их показываем как есть */
function failure(error: unknown): { ok: false; message: string } {
  if (!(error instanceof ApiError)) throw error
  const message = error.kind === "validation" ? error.message : API_ERROR_MESSAGES[error.kind]
  return { ok: false, message }
}

async function run<T>(input: unknown, operation: (request: z.infer<typeof requestSchema>) => Promise<T>): Promise<ImportActionResult<T>> {
  if (isMockDataSource) return { ok: false, message: "В демо-режиме загрузка файлов не работает: нужен сервер." }
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Файл не принят" }
  try {
    return { ok: true, data: await operation(parsed.data) }
  } catch (error) {
    return failure(error)
  }
}

/** Проверка файла: какие строки новые, какие дубли, где ошибки. Ничего не создаёт */
export async function previewImportAction(input: unknown): Promise<ImportActionResult<ImportPreview>> {
  return run(input, async (request) => previewImport(await getActionAuth(), request))
}

/** Загрузка: backend повторяет проверку и создаёт только новые строки */
export async function commitImportAction(input: unknown): Promise<ImportActionResult<ImportJob>> {
  return run(input, async (request) => {
    const job = await commitImport(await getActionAuth(), request)
    revalidatePath(routes.prospects)
    revalidatePath(routes.clientBase)
    revalidatePath(routes.sales)
    revalidatePath("/settings/import")
    return job
  })
}
