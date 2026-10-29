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
  platformNew: "/platform/new",
} as const

export type AppRoute = (typeof routes)[keyof typeof routes]

/** Карточка лида */
export function teamMemberRoute(managerId: string): string {
  return `${routes.team}/${encodeURIComponent(managerId)}`
}

export function leadRoute(leadId: string): string {
  return `${routes.leads}/${encodeURIComponent(leadId)}`
}
