import { isMockDataSource } from "@/config/env"
import {
  leadActivitySchema,
  leadDetailSchema,
  leadOptionSchema,
  type LeadActivity,
  type LeadDetail,
  type LeadOption,
} from "@/features/leads/schemas"
import { contractPending } from "@/lib/api/errors"
import { demoDeals } from "@/mocks/crm"
import { simulateLatency } from "@/mocks/latency"
import { demoOwnScope } from "@/mocks/scope"
import { demoLeadActivity, demoLeadDetail } from "@/mocks/lead-details"

export type LeadsRepository = {
  /** null — лид не найден или недоступен пользователю */
  getLead(leadId: string): Promise<LeadDetail | null>
  /** Лента событий по лиду, новые сверху */
  getActivity(leadId: string): Promise<LeadActivity[]>
  /** Короткий список лидов для выбора в формах (поиск по имени — на backend) */
  listOptions(): Promise<LeadOption[]>
}

const mockLeadsRepository: LeadsRepository = {
  async getLead(leadId) {
    await simulateLatency(300)
    const [lead, ownScope] = [demoLeadDetail(leadId), await demoOwnScope()]
    // Чужой лид для менеджера — как 404 от backend: данных нет вовсе
    if (!lead || (ownScope && lead.manager.id !== ownScope)) return null
    return leadDetailSchema.parse(lead)
  },

  async getActivity(leadId) {
    await simulateLatency(500)
    return leadActivitySchema.array().parse(demoLeadActivity(leadId))
  },

  async listOptions() {
    await simulateLatency(150)
    const ownScope = await demoOwnScope()
    const deals = demoDeals.filter((deal) => !ownScope || deal.manager.id === ownScope)
    return leadOptionSchema.array().parse(deals.map((deal) => ({ id: deal.id, name: deal.title })))
  },
}

/** Endpoint не согласованы — см. docs/API_CONTRACT.md, раздел «Карточка лида». */
const httpLeadsRepository: LeadsRepository = {
  async getLead() {
    return contractPending("карточка лида")
  },
  async getActivity() {
    return contractPending("история лида")
  },
  async listOptions() {
    return contractPending("поиск лидов")
  },
}

export const leadsRepository: LeadsRepository = isMockDataSource
  ? mockLeadsRepository
  : httpLeadsRepository
