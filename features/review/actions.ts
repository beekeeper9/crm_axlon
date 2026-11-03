"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { createReviewTask } from "@/features/review/api/review-repository"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

const packageSchema = z.object({
  assigneeId: z.string().min(1, "Выберите сотрудника"),
  dealIds: z.array(z.string().min(1)).min(1, "Выберите хотя бы одну сделку").max(30, "Не больше 30 сделок в пакете"),
  title: z.string().trim().min(3, "Опишите, что сделать — хотя бы 3 символа").max(200, "Не длиннее 200 символов"),
  note: z.string().trim().max(2000, "Не длиннее 2000 символов"),
  dueDate: z.iso.date("Укажите срок"),
})

export type ReviewPackageResult = { created: number; failed: { dealId: string; message: string }[] } | { error: string }

/**
 * Выдать пакет разбора: по задаче на каждую сделку. Сделки обрабатываются по одной —
 * если у сделки уже две открытые задачи (лимит backend), она попадает в список неудачных.
 */
export async function issueReviewPackageAction(input: z.input<typeof packageSchema>): Promise<ReviewPackageResult> {
  if (isMockDataSource) return { error: "В демо-режиме разборы на сервер не отправляются." }
  const parsed = packageSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" }
  const auth = await getActionAuth()
  const { dealIds, ...task } = parsed.data
  let created = 0
  const failed: { dealId: string; message: string }[] = []
  for (const dealId of dealIds) {
    try {
      await createReviewTask(auth, { ...task, note: task.note || null, dealId })
      created += 1
    } catch (error) {
      if (!(error instanceof ApiError)) throw error
      const message =
        error.kind === "conflict"
          ? "у сделки уже две открытые задачи"
          : error.kind === "forbidden"
            ? "нет права ставить задачу этому сотруднику"
            : apiErrorMessage(error)
      failed.push({ dealId, message })
    }
  }
  if (created > 0) revalidatePath(routes.review)
  return { created, failed }
}
