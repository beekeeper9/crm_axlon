import { leadRoute, prospectRoute, routes, teamMemberRoute } from "@/config/routes"
import { isTodayActionKind, type TodayActionGroup, type TodayActionItem } from "@/features/team-cabinet/api/today-actions"
import { cabinetLinks } from "@/features/team-cabinet/lib/links"
import { formatDateTime, formatDayMonth, formatDecimalMoney, pluralize } from "@/lib/format"
import { hrefWithParams } from "@/lib/search-params"

/** Подписи кодов причин backend */
export const TODAY_REASON_LABELS: Record<string, string> = {
  after_meeting: "после встречи",
  prepayment: "есть предоплата",
  debt: "есть долг",
  not_on_shift: "не начал смену",
  no_activity: "нет звонков, встреч и оплат",
}

const days = (n: number) => `${n} ${pluralize(n, ["день", "дня", "дней"])}`

/** Экран со всей группой: тот же фильтр, что у правила */
export function todayGroupHref(kind: string): string | null {
  if (!isTodayActionKind(kind)) return null
  switch (kind) {
    case "payments_to_verify":
      return routes.paymentReview
    case "overdue_tasks":
      return hrefWithParams(routes.tasks, {}, { due: "overdue" })
    case "tasks_due_soon":
      return hrefWithParams(routes.tasks, {}, { due: "today" })
    case "meetings_without_outcome":
      return routes.afterMeeting
    case "deals_without_next_step":
      return cabinetLinks.noNextStep()
    case "deals_to_push":
      return routes.leads
    case "leads_without_contact":
      return routes.prospects
    case "managers_without_activity":
      return hrefWithParams(routes.team, {}, { tab: "silence" })
    case "miss_tasks":
      return routes.tasks
    case "debts_to_collect":
      return routes.leads
  }
}

/** Карточка, где действие выполняется: сделка — «/leads/{id}», входящий лид — «/prospects/{id}» */
function subjectHref(item: TodayActionItem): string | null {
  if (!item.subjectId) return null
  if (item.subjectType === "deal") return leadRoute(item.subjectId)
  if (item.subjectType === "lead") return prospectRoute(item.subjectId)
  return null
}

export function todayItemHref(kind: string, item: TodayActionItem): string | null {
  if (!isTodayActionKind(kind)) return null
  switch (kind) {
    case "payments_to_verify":
      return routes.paymentReview
    case "overdue_tasks":
      return subjectHref(item) ?? hrefWithParams(routes.tasks, {}, { assignee: item.managerId, due: "overdue" })
    case "tasks_due_soon":
      return subjectHref(item) ?? hrefWithParams(routes.tasks, {}, { assignee: item.managerId })
    case "meetings_without_outcome":
      return hrefWithParams(routes.afterMeeting, {}, { host: item.managerId })
    case "deals_without_next_step":
    case "deals_to_push":
      return leadRoute(item.id)
    case "leads_without_contact":
      return prospectRoute(item.id)
    case "managers_without_activity":
      return teamMemberRoute(item.id)
    case "miss_tasks":
      return subjectHref(item) ?? hrefWithParams(routes.tasks, {}, { assignee: item.managerId })
    case "debts_to_collect":
      return leadRoute(item.id)
  }
}

const money = (amount: string | null, currency: string | null) => (amount !== null && currency ? formatDecimalMoney(amount, currency) : null)

/** Короткая строка о строке группы: сумма, срок, возраст, причины. `today` — дата компании (ГГГГ-ММ-ДД). */
export function todayItemMeta(kind: string, item: TodayActionItem, today: string): string[] {
  const parts: (string | null)[] = []
  switch (kind) {
    case "payments_to_verify":
      parts.push(money(item.amount, item.currency), item.ageDays ? `ждёт ${days(item.ageDays)}` : "внесена сегодня")
      break
    case "overdue_tasks":
      parts.push(item.ageDays !== null ? `просрочена на ${days(item.ageDays)}` : null)
      break
    case "tasks_due_soon":
      parts.push(item.date === today ? "срок сегодня" : "срок завтра")
      break
    case "meetings_without_outcome":
      parts.push(item.at ? `встреча ${formatDateTime(item.at)}` : null)
      break
    case "deals_without_next_step":
      parts.push(money(item.amount, item.currency), item.stageName, item.ageDays !== null ? `без изменений ${days(item.ageDays)}` : null)
      break
    case "deals_to_push":
      parts.push(
        money(item.amount, item.currency),
        item.ageDays !== null ? `на этапе ${days(item.ageDays)}` : null,
        ...item.reasons.map((code) => (code === "debt" && item.debt ? `долг ${money(item.debt, item.currency)}` : (TODAY_REASON_LABELS[code] ?? code)))
      )
      break
    case "leads_without_contact":
      parts.push(item.at ? `пришёл ${formatDateTime(item.at)}` : null)
      break
    case "managers_without_activity":
      parts.push(...item.reasons.map((code) => TODAY_REASON_LABELS[code] ?? code))
      break
    case "miss_tasks":
      parts.push(item.ageDays ? `просрочена на ${days(item.ageDays)}` : item.date ? `срок ${item.date === today ? "сегодня" : formatDayMonth(item.date)}` : null)
      break
    case "debts_to_collect":
      parts.push(
        item.debt ? `долг ${money(item.debt, item.currency)}` : null,
        item.paid ? `оплачено ${money(item.paid, item.currency)} из ${money(item.amount, item.currency)}` : null,
        item.stageName
      )
      break
  }
  return parts.filter((part): part is string => Boolean(part))
}

export type ManagerBlock = { id: string; name: string; total: number; groups: { group: TodayActionGroup; items: TodayActionItem[] }[] }

/** Строки групп, разложенные по менеджерам: у кого больше дел — выше */
export function groupByManager(groups: readonly TodayActionGroup[]): ManagerBlock[] {
  const blocks = new Map<string, ManagerBlock>()
  for (const group of groups) {
    for (const item of group.items) {
      const id = item.managerId ?? "none"
      const block = blocks.get(id) ?? { id, name: item.managerName ?? "Без ответственного", total: 0, groups: [] }
      let entry = block.groups.find((g) => g.group.kind === group.kind)
      if (!entry) {
        entry = { group, items: [] }
        block.groups.push(entry)
      }
      entry.items.push(item)
      block.total += 1
      blocks.set(id, block)
    }
  }
  return [...blocks.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ru"))
}
