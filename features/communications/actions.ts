"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import {
  createTemplate,
  deleteTemplate,
  TEMPLATE_BODY_MAX,
  TEMPLATE_TITLE_MAX,
  updateTemplate,
} from "@/features/communications/api/communications-repository"
import { API_ERROR_MESSAGES, ApiError } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

/** null — сохранено; иначе сообщение для пользователя */
export type TemplateActionResult = string | null

const TEMPLATES_PATH = "/settings/templates"

const templateSchema = z.object({
  title: z.string().trim().min(1, "Введите название").max(TEMPLATE_TITLE_MAX, `Название — до ${TEMPLATE_TITLE_MAX} символов`),
  body: z.string().trim().min(1, "Введите текст").max(TEMPLATE_BODY_MAX, `Текст — до ${TEMPLATE_BODY_MAX} символов`),
})

async function save(operation: () => Promise<unknown>): Promise<TemplateActionResult> {
  if (isMockDataSource) return "В демо-режиме шаблоны не сохраняются."
  try {
    await operation()
    revalidatePath(TEMPLATES_PATH)
    return null
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.code === "feature_not_in_plan") return "Переписки и шаблоны не входят в тариф компании."
    if (error.kind === "forbidden") return "Шаблоны компании меняют директор и РОП."
    return error.kind === "validation" ? error.message : API_ERROR_MESSAGES[error.kind]
  }
}

function parseTemplate(input: unknown): string | z.infer<typeof templateSchema> {
  const parsed = templateSchema.safeParse(input)
  return parsed.success ? parsed.data : (parsed.error.issues[0]?.message ?? "Проверьте шаблон")
}

export async function createTemplateAction(input: unknown): Promise<TemplateActionResult> {
  const data = parseTemplate(input)
  if (typeof data === "string") return data
  return save(async () => createTemplate(await getActionAuth(), data))
}

export async function updateTemplateAction(id: string, input: unknown): Promise<TemplateActionResult> {
  const data = parseTemplate(input)
  if (typeof data === "string") return data
  return save(async () => updateTemplate(await getActionAuth(), id, data))
}

export async function deleteTemplateAction(id: string): Promise<TemplateActionResult> {
  return save(async () => deleteTemplate(await getActionAuth(), id))
}
