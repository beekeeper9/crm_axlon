import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { teamMembersSchema, type TeamMember } from "@/features/team/schemas"
import { apiRequest } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { paginatedSchema } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { getCurrentUser } from "@/lib/session/current-user"
import { simulateLatency } from "@/mocks/latency"
import { demoManagers } from "@/mocks/team"

export type TeamRepository = {
  /** Сотрудники, которых пользователь может видеть в фильтрах (область видимости — backend) */
  listMembers(): Promise<TeamMember[]>
  /** Имена всех действующих сотрудников компании — доступны любой роли, только имена */
  listNames(): Promise<TeamMember[]>
}

const mockTeamRepository: TeamRepository = {
  async listMembers() {
    await simulateLatency(150)
    return teamMembersSchema.parse(demoManagers)
  },
  async listNames() {
    await simulateLatency(100)
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

/** `GET /api/v1/staff/names/`: имена коллег без контактов и ролей */
const backendNamesSchema = paginatedSchema(z.object({ userId: z.string(), fullName: z.string() }))

const httpTeamRepository: TeamRepository = {
  async listNames() {
    const names = await apiRequest("/api/v1/staff/names/", { auth: await getRenderAuth(), schema: backendNamesSchema })
    return names.results.map((member) => ({ id: member.userId, name: member.fullName }))
  },
  async listMembers() {
    const staff = await apiRequest("/api/v1/staff/", { auth: await getRenderAuth(), schema: backendStaffSchema })
    return staff.results
      .filter((member) => member.status !== "deactivated")
      .map((member) => ({ id: member.userId, name: member.fullName || member.login }))
  },
}

export const teamRepository: TeamRepository = isMockDataSource ? mockTeamRepository : httpTeamRepository

/**
 * Сотрудники для фильтров и выбора исполнителя. Не у каждой роли с обзором команды есть право
 * на список сотрудников (наблюдатель получает 403) — тогда список пуст, а страница работает.
 */
export async function listMembersIfAllowed(): Promise<TeamMember[]> {
  try {
    return await teamRepository.listMembers()
  } catch (error) {
    if (error instanceof ApiError && error.kind === "forbidden") return []
    throw error
  }
}

/** Имена сотрудников компании по id пользователя — для подписей «ответственный», «исполнитель» */
export async function loadMemberNames(): Promise<Map<string, string>> {
  return new Map((await teamRepository.listNames()).map((member) => [member.id, member.name]))
}

/** Имя по id пользователя: без права на список сотрудников известно только своё */
export async function loadPeopleNames(): Promise<(userId: string) => string> {
  const [memberNames, user] = await Promise.all([loadMemberNames(), getCurrentUser()])
  return (userId) => (userId === user.id ? user.fullName : memberNames.get(userId) ?? "Сотрудник")
}
