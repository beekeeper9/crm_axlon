import { z } from "zod"

import { stageKindSchema, systemStageSchema } from "@/features/sales/schemas"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"

/**
 * Настройка воронки (`/sales/pipelines/…`). Воронка компании или отдела: РОП меняет только
 * воронку своего отдела, директор — любую, менеджер — никакую. Права проверяет backend.
 */

export const funnelStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.int(),
  kind: stageKindSchema,
  isActive: z.boolean(),
  /** Системный этап: «Продажа» (не меняется, всегда последний) или «Встреча перенесена» (можно выключить) */
  systemCode: systemStageSchema.nullable().optional(),
  /** Только с `?counts=true` */
  openDeals: z.int().nonnegative().optional(),
  totalDeals: z.int().nonnegative().optional(),
})

export const funnelSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  departmentId: z.string().nullable(),
  stages: z.array(funnelStageSchema),
})

export type FunnelStage = z.infer<typeof funnelStageSchema>
export type Funnel = z.infer<typeof funnelSchema>

const BASE = "/api/v1/sales/pipelines/"
const pipelinePath = (id: string) => `${BASE}${encodeURIComponent(id)}/`
const stagePath = (pipelineId: string, stageId: string) => `${pipelinePath(pipelineId)}stages/${encodeURIComponent(stageId)}/`

/** Видимые пользователю воронки: сначала воронки его отдела (по умолчанию — первой) */
export function listFunnels(auth: ApiAuth): Promise<Funnel[]> {
  return apiRequest(BASE, { auth, schema: z.array(funnelSchema) })
}

/** Воронка с количеством сделок на этапах (403 для тех, кто не может её настраивать) */
export function getFunnelWithCounts(auth: ApiAuth, pipelineId: string): Promise<Funnel> {
  return apiRequest(pipelinePath(pipelineId), { auth, query: { counts: "true" }, schema: funnelSchema })
}

export type NewFunnelStage = { name: string; kind: z.infer<typeof stageKindSchema> }

/** РОПу backend сам ставит его отдел; директор передаёт отдел (null — воронка компании) */
export function createFunnel(
  auth: ApiAuth,
  input: { name: string; stages: readonly NewFunnelStage[]; departmentId: string | null }
): Promise<Funnel> {
  return apiRequest(BASE, {
    method: "POST",
    auth,
    body: { name: input.name, stages: input.stages, ...(input.departmentId ? { departmentId: input.departmentId } : {}) },
    schema: funnelSchema,
  })
}

export function addStage(auth: ApiAuth, pipelineId: string, stage: NewFunnelStage & { position?: number }): Promise<Funnel> {
  return apiRequest(`${pipelinePath(pipelineId)}stages/`, { method: "POST", auth, body: stage, schema: funnelSchema })
}

export function renameStage(auth: ApiAuth, pipelineId: string, stageId: string, name: string): Promise<Funnel> {
  return apiRequest(stagePath(pipelineId, stageId), { method: "PATCH", auth, body: { name }, schema: funnelSchema })
}

/** Включить или выключить этап (так РОП включает «Встречу перенесена» в своей воронке) */
export function setStageActive(auth: ApiAuth, pipelineId: string, stageId: string, isActive: boolean): Promise<Funnel> {
  return apiRequest(stagePath(pipelineId, stageId), { method: "PATCH", auth, body: { isActive }, schema: funnelSchema })
}

/** Порядок всех этапов воронки, включая архивные (так требует backend) */
export function reorderStages(auth: ApiAuth, pipelineId: string, stageIds: readonly string[]): Promise<Funnel> {
  return apiRequest(`${pipelinePath(pipelineId)}stage-order/`, { method: "PUT", auth, body: { stageIds }, schema: funnelSchema })
}

export const stageRemovalSchema = z.object({ pipeline: funnelSchema, movedDeals: z.int().nonnegative(), archived: z.boolean() })
export type StageRemoval = z.infer<typeof stageRemovalSchema>

/** Удалить этап; сделки этапа переходят на `moveToStageId` (этап того же вида), переход — в истории сделки */
export function deleteStage(auth: ApiAuth, pipelineId: string, stageId: string, moveToStageId: string | null): Promise<StageRemoval> {
  return apiRequest(stagePath(pipelineId, stageId), {
    method: "DELETE",
    auth,
    query: moveToStageId ? { moveToStageId } : undefined,
    schema: stageRemovalSchema,
  })
}

/** Переименовать воронку (например, «Воронка отдела» → «Холодные звонки») */
export function renameFunnel(auth: ApiAuth, pipelineId: string, name: string): Promise<Funnel> {
  return apiRequest(pipelinePath(pipelineId), { method: "PATCH", auth, body: { name }, schema: funnelSchema })
}

/** Сделать воронку основной в её отделе (или в компании): туда попадают новые сделки */
export function makeDefault(auth: ApiAuth, pipelineId: string): Promise<Funnel> {
  return apiRequest(pipelinePath(pipelineId), { method: "PATCH", auth, body: { isDefault: true }, schema: funnelSchema })
}

const departmentSchema = z.object({ id: z.string(), name: z.string() })

/** Отделы — директору для выбора, чью воронку настраивать */
export function listDepartments(auth: ApiAuth): Promise<{ id: string; name: string }[]> {
  return apiRequest("/api/v1/departments/", {
    auth,
    schema: z.union([z.array(departmentSchema), z.object({ results: z.array(departmentSchema) }).transform((page) => page.results)]),
  })
}

export const adoptionPreviewSchema = z.object({
  fromPipelineId: z.string(),
  fromPipelineName: z.string(),
  total: z.int().nonnegative(),
  stages: z.array(z.object({ stageId: z.string(), name: z.string(), kind: stageKindSchema, openDeals: z.int().nonnegative() })),
})

export type AdoptionPreview = z.infer<typeof adoptionPreviewSchema>

/**
 * `GET …/adopt-deals/?from_pipeline_id=` — сколько открытых сделок менеджеров отдела ещё стоит
 * в общей воронке компании, по этапам. Ничего не переносит.
 */
export function adoptionPreview(auth: ApiAuth, pipelineId: string, fromPipelineId: string): Promise<AdoptionPreview> {
  return apiRequest(`${pipelinePath(pipelineId)}adopt-deals/`, { auth, query: { fromPipelineId }, schema: adoptionPreviewSchema })
}

/** `POST …/adopt-deals/` — перенос по сопоставлению этапов, подтверждённому пользователем */
export function adoptDeals(
  auth: ApiAuth,
  pipelineId: string,
  fromPipelineId: string,
  stageMap: Record<string, string>
): Promise<{ moved: number }> {
  return apiRequest(`${pipelinePath(pipelineId)}adopt-deals/`, {
    method: "POST",
    auth,
    body: { fromPipelineId, stageMap },
    schema: z.object({ moved: z.int().nonnegative() }),
  })
}
