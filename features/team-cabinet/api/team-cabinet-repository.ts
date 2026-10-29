import { isMockDataSource } from "@/config/env"
import {
  memberCardSchema,
  teamFunnelSchema,
  teamQualitySchema,
  teamTodaySchema,
  type MemberCard,
  type QualityPeriod,
  type TeamFunnel,
  type TeamQuality,
  type TeamToday,
} from "@/features/team-cabinet/schemas"
import { contractPending } from "@/lib/api/errors"
import { simulateLatency } from "@/mocks/latency"
import { demoRequirePermission } from "@/mocks/scope"
import { demoMemberCard, demoTeamFunnel, demoTeamQuality, demoTeamToday } from "@/mocks/team-cabinet"

/**
 * Данные кабинета — только для ролей с правом cabinet.view.
 * Backend обязан сам отвечать 403 остальным; демо-слой повторяет это правило.
 */
export type TeamCabinetRepository = {
  getToday(): Promise<TeamToday>
  getQuality(period: QualityPeriod): Promise<TeamQuality>
  getFunnel(): Promise<TeamFunnel>
  /** null — сотрудник не найден или не входит в отдел руководителя */
  getMemberCard(managerId: string): Promise<MemberCard | null>
}

const mockTeamCabinetRepository: TeamCabinetRepository = {
  async getToday() {
    await simulateLatency(500)
    await demoRequirePermission("cabinet.view")
    return teamTodaySchema.parse(demoTeamToday())
  },
  async getQuality(period) {
    await simulateLatency(450)
    await demoRequirePermission("cabinet.view")
    return teamQualitySchema.parse(demoTeamQuality(period))
  },
  async getFunnel() {
    await simulateLatency(400)
    await demoRequirePermission("cabinet.view")
    return teamFunnelSchema.parse(demoTeamFunnel())
  },
  async getMemberCard(managerId) {
    await simulateLatency(500)
    await demoRequirePermission("cabinet.view")
    const card = demoMemberCard(managerId)
    return card ? memberCardSchema.parse(card) : null
  },
}

/** Endpoint не согласованы — см. docs/API_CONTRACT.md, раздел «Кабинет РОПа». */
const httpTeamCabinetRepository: TeamCabinetRepository = {
  async getToday() {
    return contractPending("кабинет РОПа: сегодня")
  },
  async getQuality() {
    return contractPending("кабинет РОПа: качество встреч и звонков")
  },
  async getFunnel() {
    return contractPending("кабинет РОПа: воронка")
  },
  async getMemberCard() {
    return contractPending("кабинет РОПа: карточка менеджера")
  },
}

export const teamCabinetRepository: TeamCabinetRepository = isMockDataSource ? mockTeamCabinetRepository : httpTeamCabinetRepository
