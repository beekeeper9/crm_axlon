import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { getRenderAuth } from "@/lib/auth/token-store"

/**
 * Автораспределение лидов (`/leads/routing/`): по кругу между менеджерами отдела, которые на смене
 * и не в отсутствии. Директор настраивает любой отдел, РОП — свой; права проверяет backend.
 * Кто сейчас получит лид, считает backend (`candidates[].eligible`).
 */

const candidateSchema = z.object({
  userId: z.string(),
  fullName: z.string().nullable(),
  selected: z.boolean(),
  onShift: z.boolean(),
  absent: z.boolean(),
  eligible: z.boolean(),
})

const routingSchema = z.object({
  departmentId: z.string(),
  enabled: z.boolean(),
  memberIds: z.array(z.string()),
  requireOnShift: z.boolean(),
  skipOnAbsence: z.boolean(),
  isCompanyIntake: z.boolean(),
  lastAssignedUserId: z.string().nullable(),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
  isDefault: z.boolean(),
  candidates: z.array(candidateSchema),
})

export type LeadRouting = z.infer<typeof routingSchema>
export type RoutingCandidate = z.infer<typeof candidateSchema>

export type LeadRoutingInput = {
  enabled: boolean
  memberIds: string[]
  requireOnShift: boolean
  skipOnAbsence: boolean
  /** Только директор; не передаётся — остаётся как есть */
  isCompanyIntake?: boolean
}

export async function fetchLeadRouting(departmentId: string | null): Promise<LeadRouting> {
  return apiRequest("/api/v1/leads/routing/", {
    auth: await getRenderAuth(),
    query: { departmentId: departmentId ?? undefined },
    schema: routingSchema,
  })
}

export function saveLeadRouting(auth: ApiAuth, departmentId: string, input: LeadRoutingInput): Promise<LeadRouting> {
  return apiRequest("/api/v1/leads/routing/", {
    method: "PUT",
    auth,
    query: { departmentId },
    body: input,
    schema: routingSchema,
  })
}
