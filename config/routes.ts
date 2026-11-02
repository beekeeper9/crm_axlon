/** Единый источник путей приложения. Не пишем "/focus" строками по коду. */
export const routes = {
  myDay: "/my-day",
  focus: "/focus",
  sales: "/sales",
  afterMeeting: "/after-meeting",
  meetings: "/meetings",
  tasks: "/tasks",
  calls: "/calls",
  dailyReports: "/daily-reports",
  review: "/review",
  leads: "/leads",
  prospects: "/prospects",
  clientBase: "/client-base",
  materials: "/materials",
  assistant: "/assistant",
  workspace: "/workspace",
  team: "/team",
  login: "/login",
  selectCompany: "/select-company",
  changePassword: "/change-password",
  staff: "/staff",
  staffNew: "/staff/new",
  company: "/company",
  platform: "/platform",
  platformCompanies: "/platform/companies",
  platformCompanyNew: "/platform/companies/new",
  platformErrors: "/platform/errors",
  platformTickets: "/platform/tickets",
  support: "/support",
} as const

export type AppRoute = (typeof routes)[keyof typeof routes]

/** Карточка лида */
export function teamMemberRoute(managerId: string): string {
  return `${routes.team}/${encodeURIComponent(managerId)}`
}

export function leadRoute(leadId: string): string {
  return `${routes.leads}/${encodeURIComponent(leadId)}`
}

/** Карточка входящего лида (до конвертации в клиента) */
export function prospectRoute(prospectId: string): string {
  return `${routes.prospects}/${encodeURIComponent(prospectId)}`
}

/** Карточка компании в панели администратора платформы */
export function platformCompanyRoute(companyId: string): string {
  return `${routes.platformCompanies}/${encodeURIComponent(companyId)}`
}

export function platformTicketRoute(ticketId: string): string {
  return `${routes.platformTickets}/${encodeURIComponent(ticketId)}`
}
