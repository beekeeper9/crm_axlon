import { z } from "zod"

import { importJobSchema, importPreviewSchema, type ImportJob, type ImportPreview, type ImportRequest } from "@/features/imports/schemas"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"

function requestBody(input: ImportRequest) {
  return {
    entity: input.entity,
    filename: input.filename,
    content: input.content,
    ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
  }
}

/** Разбор и проверка дублей по нормализованным телефону и e-mail — ничего не создаёт */
export function previewImport(auth: ApiAuth, input: ImportRequest): Promise<ImportPreview> {
  return apiRequest("/api/v1/imports/preview/", { method: "POST", auth, body: requestBody(input), schema: importPreviewSchema })
}

/** Создаёт только новые строки; дубли и ошибочные пропускает. Backend пишет запись в журнал */
export function commitImport(auth: ApiAuth, input: ImportRequest): Promise<ImportJob> {
  return apiRequest("/api/v1/imports/", { method: "POST", auth, body: requestBody(input), schema: importJobSchema })
}

/** Последние 20 загрузок компании */
export async function fetchRecentImports(auth: ApiAuth): Promise<ImportJob[]> {
  const page = await apiRequest("/api/v1/imports/", { auth, schema: z.object({ results: z.array(importJobSchema) }) })
  return page.results
}
