import { ticketSchema, type Ticket, type TicketKind } from "@/features/platform/schemas"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { paginatedSchema } from "@/lib/api/pagination"

/** Обращения сотрудника компании к платформе: `/api/v1/support/tickets/` (только свои) */
export function listMyTickets(auth: ApiAuth): Promise<Ticket[]> {
  return apiRequest("/api/v1/support/tickets/", { auth, query: { limit: 50 }, schema: paginatedSchema(ticketSchema) }).then((page) => page.results)
}

export function sendTicket(auth: ApiAuth, input: { kind: TicketKind; subject: string; body: string }): Promise<Ticket> {
  return apiRequest("/api/v1/support/tickets/", { method: "POST", auth, body: input, schema: ticketSchema })
}
