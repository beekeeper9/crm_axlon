import { routes, teamMemberRoute } from "@/config/routes"
import type { AttentionItem } from "@/features/team-cabinet/schemas"

/** Каждое число кабинета ведёт на существующий экран с уже применённым фильтром (ТЗ, п. 4.2) */
export const cabinetLinks = {
  meetingsToday: (managerId?: string) => withQuery(routes.meetings, { host: managerId }),
  meetingsWithoutOutcome: (managerId?: string) => withQuery(routes.meetings, { host: managerId, outcome: "required" }),
  afterMeeting: (managerId?: string) => withQuery(routes.afterMeeting, { host: managerId }),
  tasks: (managerId?: string) => withQuery(routes.tasks, { assignee: managerId }),
  noNextStep: (managerId?: string) => withQuery(routes.leads, { manager: managerId, attention: "no_next_step" }),
  calls: (managerId?: string) => withQuery(routes.calls, { manager: managerId }),
  call: (callId: string) => withQuery(routes.calls, { call: callId }),
  member: (managerId: string) => teamMemberRoute(managerId),
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])))
  return query.size ? `${path}?${query}` : path
}

export function attentionHref(item: AttentionItem): string {
  const id = item.manager?.id
  switch (item.target) {
    case "meetings":
      return cabinetLinks.meetingsToday(id)
    case "meetings_outcome":
      return cabinetLinks.meetingsWithoutOutcome(id)
    case "after_meeting":
      return cabinetLinks.afterMeeting(id)
    case "tasks":
      return cabinetLinks.tasks(id)
    case "leads_no_step":
      return cabinetLinks.noNextStep(id)
    case "calls":
      return cabinetLinks.calls(id)
    case "manager":
      return id ? cabinetLinks.member(id) : routes.team
  }
}
