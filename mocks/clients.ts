/**
 * ДЕМО-ДАННЫЕ клиентской базы: клиенты собраны из демо-сделок по имени клиента.
 * В реальном режиме клиент — отдельная сущность backend (контракт не согласован).
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import { clientSummarySchema, type ClientDetail, type ClientSummary } from "@/features/clients/schemas"
import { demoDeals, demoSalesConfig } from "@/mocks/crm"
import { demoLeadActivity, demoLeadDetail } from "@/mocks/lead-details"

const stages = new Map(
  demoSalesConfig.pipelines.flatMap((pipeline) => pipeline.stages.map((stage) => [stage.id, { stage, pipelineName: pipeline.name }] as const))
)

function clientId(name: string): string {
  const first = demoDeals.find((deal) => deal.client.name === name)
  return `client-${first?.id ?? name}`
}

function buildClient(name: string): ClientDetail {
  const deals = demoDeals.filter((deal) => deal.client.name === name).toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const open = deals.filter((deal) => stages.get(deal.stageId)?.stage.kind === "open")
  const current = open[0] ?? null
  const latest = deals[0]
  const detail = latest ? demoLeadDetail(latest.id) : null
  const activity = deals
    .flatMap((deal) => demoLeadActivity(deal.id).map((item) => ({ id: item.id, at: item.at, title: item.title, dealTitle: deal.title })))
    .toSorted((a, b) => b.at.localeCompare(a.at))

  return {
    id: clientId(name),
    name,
    phones: [...new Set(deals.flatMap((deal) => (deal.client.phone ? [deal.client.phone] : [])))],
    email: detail?.client.email ?? null,
    city: detail?.client.city ?? null,
    manager: (current ?? latest)?.manager ?? null,
    openDealsCount: open.length,
    dealsCount: deals.length,
    currentDeal: current && { id: current.id, stageName: stages.get(current.stageId)?.stage.name ?? "" },
    lastInteractionAt: activity[0]?.at ?? null,
    deals: deals.map((deal) => {
      const info = stages.get(deal.stageId)
      return {
        id: deal.id,
        title: deal.title,
        pipelineName: info?.pipelineName ?? "",
        stageName: info?.stage.name ?? "",
        stageKind: info?.stage.kind ?? "open",
        amount: deal.amount,
        currency: deal.currency,
        updatedAt: deal.updatedAt,
      }
    }),
    recentActivity: activity.slice(0, 6),
  }
}

export const demoClients: ClientDetail[] = [...new Set(demoDeals.map((deal) => deal.client.name))].map(buildClient)

export function toClientSummary(client: ClientDetail): ClientSummary {
  return clientSummarySchema.parse(client)
}
