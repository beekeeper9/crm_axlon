"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { addReferenceItem, reorderReferenceList, updateReferenceItem } from "@/features/reference-lists/api/reference-lists"
import { REFERENCE_LISTS, REFERENCE_LISTS_ROUTE, type ReferenceListKey } from "@/features/reference-lists/lib/lists"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

/** null — сохранено; иначе сообщение для пользователя */
export type ReferenceActionResult = string | null

const keySchema = z.enum(REFERENCE_LISTS)
const labelSchema = z.string().trim().min(1, "Введите название").max(100, "Не длиннее 100 символов")

async function save(operation: () => Promise<unknown>): Promise<ReferenceActionResult> {
  if (isMockDataSource) return "В демо-режиме справочники на сервер не сохраняются."
  if (!hasPermission((await getCurrentUser()).role, "company.settings")) return "Справочники меняет директор."
  try {
    await operation()
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.kind === "conflict") return "Такой пункт уже есть в списке."
    if (error.kind === "forbidden") return "Справочники меняет директор."
    if (error.kind === "validation") return `Сервер не принял данные: ${error.message}`
    return apiErrorMessage(error)
  }
  revalidatePath(REFERENCE_LISTS_ROUTE)
  return null
}

export async function addReferenceItemAction(key: ReferenceListKey, label: string): Promise<ReferenceActionResult> {
  const parsedKey = keySchema.safeParse(key)
  const parsed = labelSchema.safeParse(label)
  if (!parsedKey.success) return "Неизвестный справочник."
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Введите название"
  return save(async () => addReferenceItem(await getActionAuth(), parsedKey.data, parsed.data))
}

export async function updateReferenceItemAction(
  key: ReferenceListKey,
  ref: string,
  patch: { label?: string; isActive?: boolean }
): Promise<ReferenceActionResult> {
  const parsedKey = keySchema.safeParse(key)
  if (!parsedKey.success || !ref) return "Неизвестный пункт справочника."
  let label: string | undefined
  if (patch.label !== undefined) {
    const parsed = labelSchema.safeParse(patch.label)
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Введите название"
    label = parsed.data
  }
  return save(async () => updateReferenceItem(await getActionAuth(), parsedKey.data, ref, { label, isActive: patch.isActive }))
}

export async function reorderReferenceListAction(key: ReferenceListKey, ids: readonly string[]): Promise<ReferenceActionResult> {
  if (key !== "meeting_cancel" && key !== "meeting_no_show") return "Этот список не сортируется."
  const parsed = z.array(z.string().min(1)).max(50).safeParse(ids)
  if (!parsed.success) return "Неверный порядок."
  return save(async () => reorderReferenceList(await getActionAuth(), key, parsed.data))
}
