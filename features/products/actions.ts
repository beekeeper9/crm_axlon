"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { createProduct, updateProduct } from "@/features/products/api/products"
import { REFERENCE_LISTS_ROUTE } from "@/features/reference-lists/lib/lists"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

/** null — сохранено; иначе сообщение для пользователя */
export type ProductActionResult = string | null

const NOT_ALLOWED = "Продукты ведут директор и руководитель отдела продаж."
const nameSchema = z.string().trim().min(1, "Введите название").max(100, "Не длиннее 100 символов")

async function save(operation: () => Promise<unknown>): Promise<ProductActionResult> {
  if (isMockDataSource) return "В демо-режиме продукты на сервер не сохраняются."
  if (!hasPermission((await getCurrentUser()).role, "pipelines.configure")) return NOT_ALLOWED
  try {
    await operation()
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.kind === "conflict") return "Такой продукт уже есть."
    if (error.kind === "forbidden") return NOT_ALLOWED
    if (error.kind === "validation") return `Сервер не принял данные: ${error.message}`
    return apiErrorMessage(error)
  }
  revalidatePath(REFERENCE_LISTS_ROUTE)
  return null
}

export async function createProductAction(name: string): Promise<ProductActionResult> {
  const parsed = nameSchema.safeParse(name)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Введите название"
  return save(async () => createProduct(await getActionAuth(), parsed.data))
}

export async function updateProductAction(
  productId: string,
  patch: { name?: string; isActive?: boolean; showOnMyDay?: boolean }
): Promise<ProductActionResult> {
  if (!productId) return "Неизвестный продукт."
  let name: string | undefined
  if (patch.name !== undefined) {
    const parsed = nameSchema.safeParse(patch.name)
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Введите название"
    name = parsed.data
  }
  return save(async () => updateProduct(await getActionAuth(), productId, { name, isActive: patch.isActive, showOnMyDay: patch.showOnMyDay }))
}
