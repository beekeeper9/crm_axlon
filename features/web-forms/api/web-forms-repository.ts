import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { getRenderAuth } from "@/lib/auth/token-store"

/**
 * Ключи форм сайта (`/web-forms/keys/`): по ключу публичный endpoint `POST /public/leads/{token}/`
 * находит компанию и отдел. Директор управляет ключами любого отдела, РОП — своего; права проверяет backend.
 */

export const webFormKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  departmentId: z.string(),
  departmentName: z.string().nullable(),
  token: z.string(),
  /** Путь относительно адреса API, например `/api/v1/public/leads/…/` */
  endpointPath: z.string(),
  isActive: z.boolean(),
  createdBy: z.string(),
  createdByName: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  revokedAt: z.iso.datetime({ offset: true }).nullable(),
  lastUsedAt: z.iso.datetime({ offset: true }).nullable(),
  leadsCount: z.number().int().nonnegative(),
})

export type WebFormKey = z.infer<typeof webFormKeySchema>

const keyListSchema = z.object({ count: z.number(), results: z.array(webFormKeySchema) })

const KEYS_PATH = "/api/v1/web-forms/keys/"

export async function fetchWebFormKeys(departmentId: string | null): Promise<WebFormKey[]> {
  const page = await apiRequest(KEYS_PATH, {
    auth: await getRenderAuth(),
    query: { departmentId: departmentId ?? undefined },
    schema: keyListSchema,
  })
  return page.results
}

export type CreateWebFormKeyInput = { name: string; departmentId: string }

export function createWebFormKey(auth: ApiAuth, input: CreateWebFormKeyInput): Promise<WebFormKey> {
  return apiRequest(KEYS_PATH, { method: "POST", auth, body: input, schema: webFormKeySchema })
}

export function revokeWebFormKey(auth: ApiAuth, keyId: string): Promise<WebFormKey> {
  return apiRequest(`${KEYS_PATH}${encodeURIComponent(keyId)}/revoke/`, { method: "POST", auth, schema: webFormKeySchema })
}
