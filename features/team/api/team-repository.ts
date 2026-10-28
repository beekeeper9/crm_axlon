import { isMockDataSource } from "@/config/env"
import { teamMembersSchema, type TeamMember } from "@/features/team/schemas"
import { contractPending } from "@/lib/api/errors"
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

/** Endpoint не согласован — см. docs/API_CONTRACT.md, раздел «Сотрудники». */
const httpTeamRepository: TeamRepository = {
  async listMembers() {
    return contractPending("список сотрудников")
  },
}

export const teamRepository: TeamRepository = isMockDataSource ? mockTeamRepository : httpTeamRepository
