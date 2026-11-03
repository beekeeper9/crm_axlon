import { z } from "zod"

import type { ReferenceItem, ReferenceListKey } from "@/features/reference-lists/lib/lists"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { PAGE_LIMIT_MAX, paginatedSchema } from "@/lib/api/pagination"

/**
 * Справочники компании. Причины отказа — `/sales/loss-reasons/`; причины отмены и неявки
 * встреч и подписи источников лидов — `/reference-lists/{key}/`. Права проверяет backend:
 * меняет директор (`company.settings.manage`), читают все сотрудники.
 */

const itemSchema = z.object({
  id: z.string().nullable(),
  code: z.string().nullable(),
  label: z.string(),
  isActive: z.boolean(),
  position: z.int(),
})

const listSchema = z.object({
  key: z.enum(["meeting_cancel", "meeting_no_show", "lead_source"]),
  fixed: z.boolean(),
  editable: z.boolean(),
  items: z.array(itemSchema),
})

const lossReasonSchema = z.object({ id: z.string(), name: z.string(), isActive: z.boolean() })

type StoredKey = Exclude<ReferenceListKey, "loss_reason">

const listPath = (key: StoredKey) => `/api/v1/reference-lists/${key}/`

const toItem = (item: z.infer<typeof itemSchema>): ReferenceItem => ({
  // Источник лида адресуется кодом, свободный пункт — его id
  ref: item.code ?? item.id ?? "",
  label: item.label,
  isActive: item.isActive,
})

export async function fetchReferenceList(auth: ApiAuth, key: ReferenceListKey, activeOnly = false): Promise<ReferenceItem[]> {
  if (key === "loss_reason") {
    const page = await apiRequest("/api/v1/sales/loss-reasons/", {
      auth,
      query: { limit: PAGE_LIMIT_MAX, ...(activeOnly ? { active: "true" } : {}) },
      schema: paginatedSchema(lossReasonSchema),
    })
    return page.results.map((reason) => ({ ref: reason.id, label: reason.name, isActive: reason.isActive }))
  }
  const list = await apiRequest(listPath(key), { auth, query: activeOnly ? { active: "true" } : {}, schema: listSchema })
  return list.items.map(toItem)
}

export async function addReferenceItem(auth: ApiAuth, key: ReferenceListKey, label: string): Promise<void> {
  if (key === "loss_reason") {
    await apiRequest("/api/v1/sales/loss-reasons/", { method: "POST", auth, body: { name: label }, schema: lossReasonSchema })
    return
  }
  await apiRequest(listPath(key), { method: "POST", auth, body: { label }, schema: itemSchema })
}

export async function updateReferenceItem(
  auth: ApiAuth,
  key: ReferenceListKey,
  ref: string,
  patch: { label?: string; isActive?: boolean }
): Promise<void> {
  if (key === "loss_reason") {
    await apiRequest(`/api/v1/sales/loss-reasons/${encodeURIComponent(ref)}/`, {
      method: "PATCH",
      auth,
      body: { ...(patch.label !== undefined ? { name: patch.label } : {}), ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}) },
      schema: lossReasonSchema,
    })
    return
  }
  await apiRequest(`${listPath(key)}items/${encodeURIComponent(ref)}/`, { method: "PATCH", auth, body: patch, schema: itemSchema })
}

/** Порядок свободного списка: все id ровно по одному разу */
export async function reorderReferenceList(auth: ApiAuth, key: "meeting_cancel" | "meeting_no_show", ids: readonly string[]): Promise<void> {
  await apiRequest(`${listPath(key)}order/`, { method: "PUT", auth, body: { ids }, schema: listSchema })
}
