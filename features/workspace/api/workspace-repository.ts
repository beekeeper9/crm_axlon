import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { DEFAULT_LAYOUT, WORKSPACE_BLOCKS, type WorkspaceBlock } from "@/features/workspace/lib/blocks"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { paginatedSchema } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"

/**
 * Раскладка «Моего дня» (`/workspace/layout/`): какие блоки видят менеджеры и в каком порядке.
 * Директор настраивает компанию и любой отдел, РОП — свой отдел; права проверяет backend.
 * Скрытый блок — только оформление, а не ограничение доступа к данным.
 */

const layoutSchema = z.object({
  departmentId: z.string().nullable(),
  blocks: z.array(z.object({ id: z.enum(WORKSPACE_BLOCKS), visible: z.boolean() })),
  isDefault: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
})

export type WorkspaceLayout = z.infer<typeof layoutSchema>

const DEFAULT: WorkspaceLayout = { departmentId: null, blocks: [...DEFAULT_LAYOUT], isDefault: true, updatedAt: null }

/** Раскладка, которая действует для текущего пользователя (в демо — по умолчанию) */
export async function fetchEffectiveLayout(): Promise<WorkspaceLayout> {
  if (isMockDataSource) return DEFAULT
  return apiRequest("/api/v1/workspace/layout/effective/", { auth: await getRenderAuth(), schema: layoutSchema })
}

export async function fetchLayout(departmentId: string | null): Promise<WorkspaceLayout> {
  if (isMockDataSource) return { ...DEFAULT, departmentId }
  return apiRequest("/api/v1/workspace/layout/", {
    auth: await getRenderAuth(),
    query: { departmentId: departmentId ?? undefined },
    schema: layoutSchema,
  })
}

export function saveLayout(auth: ApiAuth, departmentId: string | null, blocks: readonly WorkspaceBlock[]): Promise<WorkspaceLayout> {
  return apiRequest("/api/v1/workspace/layout/", {
    method: "PUT",
    auth,
    query: { departmentId: departmentId ?? undefined },
    body: { blocks },
    schema: layoutSchema,
  })
}

const departmentSchema = z.object({ id: z.string(), name: z.string(), isActive: z.boolean().optional() })

/** Отделы компании — директор выбирает, чью раскладку настраивать */
export async function fetchDepartments(): Promise<{ id: string; name: string }[]> {
  if (isMockDataSource) return []
  const page = await apiRequest("/api/v1/departments/", {
    auth: await getRenderAuth(),
    schema: z.union([z.array(departmentSchema), paginatedSchema(departmentSchema).transform((p) => p.results)]),
  })
  return page.filter((department) => department.isActive !== false).map(({ id, name }) => ({ id, name }))
}

const meSchema = z.object({
  memberships: z.array(z.object({ tenant: z.string(), department: z.object({ id: z.string(), name: z.string() }).nullable().optional() })),
})

/** Отдел текущего пользователя в выбранной компании (РОП настраивает только его) */
export async function fetchOwnDepartment(): Promise<{ id: string; name: string } | null> {
  if (isMockDataSource) return null
  const auth = await getRenderAuth()
  const me = await apiRequest("/api/v1/me/", { auth, schema: meSchema })
  return me.memberships.find((membership) => membership.tenant === auth.tenant)?.department ?? null
}
