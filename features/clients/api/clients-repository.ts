import { isMockDataSource } from "@/config/env"
import { clientDetailSchema, clientSummarySchema, type ClientDetail, type ClientSummary } from "@/features/clients/schemas"
import { contractPending } from "@/lib/api/errors"
import { paginate, paginatedSchema, type PageParams, type Paginated } from "@/lib/api/pagination"
import { demoClients, toClientSummary } from "@/mocks/clients"
import { simulateLatency } from "@/mocks/latency"
import { demoOwnScope, demoScopedManagerId } from "@/mocks/scope"

/** active — есть открытая сделка; archive — все сделки закрыты */
export type ClientStatus = "active" | "archive"

export type ClientsQuery = PageParams & {
  /** Поиск по имени и телефону по всей истории, включая архив */
  search: string | null
  status: ClientStatus | null
  managerId: string | null
}

export type ClientsRepository = {
  listClients(query: ClientsQuery): Promise<Paginated<ClientSummary>>
  /** null — клиент не найден или недоступен */
  getClient(clientId: string): Promise<ClientDetail | null>
}

const clientsPageSchema = paginatedSchema(clientSummarySchema)

/** Телефон ищем по цифрам: «555 10 20» находит «+996 555 10-20-31» */
function digits(value: string): string {
  return value.replace(/\D/g, "")
}

const mockClientsRepository: ClientsRepository = {
  async listClients({ search, status, managerId: requested, limit, offset }) {
    await simulateLatency(400)
    const managerId = await demoScopedManagerId(requested)
    const needle = search?.toLocaleLowerCase("ru") ?? ""
    const needleDigits = search ? digits(search) : ""
    const clients = demoClients
      .filter((client) => !status || (status === "active" ? client.openDealsCount > 0 : client.openDealsCount === 0))
      .filter((client) => !managerId || client.manager?.id === managerId)
      .filter(
        (client) =>
          !search ||
          client.name.toLocaleLowerCase("ru").includes(needle) ||
          (needleDigits.length >= 3 && client.phones.some((phone) => digits(phone).includes(needleDigits)))
      )
      .toSorted((a, b) => (b.lastInteractionAt ?? "").localeCompare(a.lastInteractionAt ?? ""))
      .map(toClientSummary)
    return clientsPageSchema.parse(paginate(clients, { limit, offset }))
  },

  async getClient(clientId) {
    await simulateLatency(300)
    const [client, ownScope] = [demoClients.find((item) => item.id === clientId), await demoOwnScope()]
    if (!client || (ownScope && client.manager?.id !== ownScope)) return null
    return clientDetailSchema.parse(client)
  },
}

/** Endpoint не согласованы — см. docs/API_CONTRACT.md, раздел «База клиентов». */
const httpClientsRepository: ClientsRepository = {
  async listClients() {
    return contractPending("клиентская база")
  },
  async getClient() {
    return contractPending("карточка клиента")
  },
}

export const clientsRepository: ClientsRepository = isMockDataSource ? mockClientsRepository : httpClientsRepository
