"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { saveLayout } from "@/features/workspace/api/workspace-repository"
import { WORKSPACE_BLOCKS } from "@/features/workspace/lib/blocks"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

const blocksSchema = z
  .array(z.object({ id: z.enum(WORKSPACE_BLOCKS), visible: z.boolean() }))
  .min(1)
  .refine((blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length, "Блок указан дважды")

/** null — сохранено; иначе сообщение для пользователя */
export async function saveLayoutAction(departmentId: string | null, blocks: z.input<typeof blocksSchema>): Promise<string | null> {
  if (isMockDataSource) return "В демо-режиме раскладка не сохраняется."
  const parsed = blocksSchema.safeParse(blocks)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Проверьте раскладку"
  try {
    await saveLayout(await getActionAuth(), departmentId, parsed.data)
    revalidatePath(routes.workspace)
    revalidatePath(routes.myDay)
    return null
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.kind === "forbidden" && !error.code) return "Настраивать можно только раскладку своего отдела."
    if (error.kind === "not_found") return "Отдел не найден — обновите страницу."
    return apiErrorMessage(error)
  }
}
