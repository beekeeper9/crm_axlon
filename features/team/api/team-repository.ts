import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { teamMembersSchema, type TeamMember } from "@/features/team/schemas"
import { apiRequest } from "@/lib/api/client"
import { paginatedSchema } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { simulateLatency } from "@/mocks/latency"
import { demoManagers } from "@/mocks/team"

export type TeamRepository = {
  /** Сотрудники, которых пользователь может видеть в фильтрах (область видимости — backend) */
  listMembers(): Promise<TeamMember[]>
}

const mockTeamRepository: TeamRepository = {
  async listMembers() {
    await simulateLatency(150)
    return teamMembersSchema.parse(demoManagers)
  },
}

/** `GET /api/v1/staff/` (ветка P0): id сотрудника в фильтрах — id пользователя, как owner_user_id сделки */
const backendStaffSchema = paginatedSchema(
  z.object({
    userId: z.string(),
    login: z.string(),
    fullName: z.string(),
    status: z.enum(["active", "invited", "deactivated"]),
  })
)

const httpTeamRepository: TeamRepository = {
  async listMembers() {
    const staff = await apiRequest("/api/v1/staff/", { auth: await getRenderAuth(), schema: backendStaffSchema })
    return staff.results
      .filter((member) => member.status !== "deactivated")
      .map((member) => ({ id: member.userId, name: member.fullName || member.login }))
  },
}

export const teamRepository: TeamRepository = isMockDataSource ? mockTeamRepository : httpTeamRepository
