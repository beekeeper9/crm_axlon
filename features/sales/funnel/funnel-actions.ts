"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import * as api from "@/features/sales/funnel/funnel-api"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

export type FunnelActionResult<T = null> = { ok: true; data: T } | { ok: false; message: string }

/** Ответы backend → понятные сообщения */
const MESSAGES: Array<[RegExp, string]> = [
  [/Duplicate stage name/i, "Этап с таким названием уже есть в воронке."],
  [/at least one active open stage/i, "В воронке должен остаться хотя бы один рабочий этап."],
  [/at least one active won stage/i, "В воронке должен остаться этап успешного закрытия."],
  [/at least one active lost stage/i, "В воронке должен остаться этап отказа."],
  [/same kind/i, "Сделки можно перенести только на рабочий этап того же вида."],
  [/at most \d+ stages/i, "В воронке может быть не больше 20 этапов."],
  [/only your department/i, "Вы можете настраивать только воронку своего отдела."],
  [/not assigned to a department/i, "Вы не назначены в отдел — обратитесь к директору."],
]

function failure(error: unknown): FunnelActionResult<never> {
  if (!(error instanceof ApiError)) throw error
  if (error.code === "move_target_required") return { ok: false, message: "На этапе есть сделки: выберите, куда их перенести." }
  const known = MESSAGES.find(([pattern]) => pattern.test(error.message))
  if (known) return { ok: false, message: known[1] }
  if (error.kind === "forbidden" && !error.code?.includes("plan")) return { ok: false, message: "У вашей роли нет права менять эту воронку." }
  if (error.kind === "not_found") return { ok: false, message: "Воронка или этап не найдены: обновите страницу." }
  return { ok: false, message: apiErrorMessage(error) }
}

async function run<T>(operation: () => Promise<T>): Promise<FunnelActionResult<T>> {
  if (isMockDataSource) return { ok: false, message: "В демо-режиме воронка не сохраняется на сервере." }
  try {
    const data = await operation()
    // Доска менеджеров отдела читает те же этапы: обновляем и её
    revalidatePath(routes.sales, "layout")
    return { ok: true, data }
  } catch (error) {
    return failure(error)
  }
}

const nameSchema = z.string().trim().min(1, "Введите название этапа").max(100, "Не длиннее 100 символов")
const kindSchema = z.enum(["open", "won", "lost"])

export async function createFunnelAction(input: {
  name: string
  stages: { name: string; kind: "open" | "won" | "lost" }[]
  departmentId: string | null
}): Promise<FunnelActionResult<string>> {
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Введите название воронки").max(100),
      stages: z.array(z.object({ name: nameSchema, kind: kindSchema })).min(1).max(20),
      departmentId: z.string().nullable(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля" }
  return run(async () => (await api.createFunnel(await getActionAuth(), parsed.data)).id)
}

export async function addStageAction(pipelineId: string, name: string, kind: "open" | "won" | "lost", position?: number): Promise<FunnelActionResult> {
  const parsed = nameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте название" }
  return run(async () => {
    await api.addStage(await getActionAuth(), pipelineId, { name: parsed.data, kind: kindSchema.parse(kind), ...(position === undefined ? {} : { position }) })
    return null
  })
}

export async function renameStageAction(pipelineId: string, stageId: string, name: string): Promise<FunnelActionResult> {
  const parsed = nameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте название" }
  return run(async () => {
    await api.renameStage(await getActionAuth(), pipelineId, stageId, parsed.data)
    return null
  })
}

export async function reorderStagesAction(pipelineId: string, stageIds: string[]): Promise<FunnelActionResult> {
  return run(async () => {
    await api.reorderStages(await getActionAuth(), pipelineId, stageIds)
    return null
  })
}

export async function deleteStageAction(
  pipelineId: string,
  stageId: string,
  moveToStageId: string | null
): Promise<FunnelActionResult<{ movedDeals: number; archived: boolean }>> {
  return run(async () => {
    const result = await api.deleteStage(await getActionAuth(), pipelineId, stageId, moveToStageId)
    return { movedDeals: result.movedDeals, archived: result.archived }
  })
}

export async function makeDefaultFunnelAction(pipelineId: string): Promise<FunnelActionResult> {
  return run(async () => {
    await api.makeDefault(await getActionAuth(), pipelineId)
    return null
  })
}
