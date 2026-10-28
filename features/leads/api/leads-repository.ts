import { isMockDataSource } from "@/config/env"
import { leadSummarySchema, type LeadSummary } from "@/features/leads/schemas"
import { contractPending } from "@/lib/api/errors"
import { demoFocusLeads } from "@/mocks/focus"
import { simulateLatency } from "@/mocks/latency"

export type LeadsRepository = {
  /** null — лид не найден или недоступен пользователю */
  getLeadSummary(leadId: string): Promise<LeadSummary | null>
}

const mockLeadsRepository: LeadsRepository = {
  async getLeadSummary(leadId) {
    await simulateLatency(250)
    const lead = demoFocusLeads.find((item) => item.id === leadId)
    return lead ? leadSummarySchema.parse(lead) : null
  },
}

/** Endpoint не согласован — см. docs/API_CONTRACT.md, раздел «Карточка лида». */
const httpLeadsRepository: LeadsRepository = {
  async getLeadSummary() {
    return contractPending("карточка лида")
  },
}

export const leadsRepository: LeadsRepository = isMockDataSource
  ? mockLeadsRepository
  : httpLeadsRepository
