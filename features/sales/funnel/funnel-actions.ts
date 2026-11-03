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
  [/active open stage of the department pipeline/i, "Открытые сделки можно перенести только на рабочий этап воронки отдела."],
  [/only into a department pipeline/i, "Переносить сделки можно только в воронку отдела."],
  [/at most \d+ stages/i, "В воронке может быть не больше 20 этапов."],
  [/only your department/i, "Вы можете настраивать только воронку своего отдела."],
  [/not assigned to a department/i, "Вы не назначены в отдел — обратитесь к директору."],
]

function failure(error: unknown): FunnelActionResult<never> {
  if (!(error instanceof ApiError)) throw error
  if (error.code === "move_target_required") return { ok: false, message: "На этапе есть сделки: выберите, куда их перенести." }
  if (error.code === "system_stage_locked") {
    return { ok: false, message: "Это системный этап: его нельзя переименовать или удалить, а «Продажа» всегда стоит последней." }
  }
  if (error.code === "stage_in_use") return { ok: false, message: "На этапе есть сделки в работе: сначала переведите их на другой этап." }
  if (error.code === "stage_mapping_required") return { ok: false, message: "Выберите этап воронки отдела для каждого этапа, на котором есть сделки." }
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

export async function setStageActiveAction(pipelineId: string, stageId: string, isActive: boolean): Promise<FunnelActionResult> {
  return run(async () => {
    await api.setStageActive(await getActionAuth(), pipelineId, stageId, isActive)
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

/** Перенос открытых сделок менеджеров отдела из общей воронки — только после подтверждения пользователем */
export async function adoptDealsAction(pipelineId: string, fromPipelineId: string, stageMap: Record<string, string>): Promise<FunnelActionResult<number>> {
  return run(async () => (await api.adoptDeals(await getActionAuth(), pipelineId, fromPipelineId, stageMap)).moved)
}
