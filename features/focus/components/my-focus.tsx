import Link from "next/link"
import { Target } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { MetricHint } from "@/components/shared/metric-hint"
import { Card } from "@/components/ui/card"
import { fetchMyFocus, type TodayActionGroup } from "@/features/team-cabinet/api/today-actions"
import { todayGroupHref, todayItemHref, todayItemMeta } from "@/features/team-cabinet/lib/today-actions"
import { tryLoad } from "@/lib/api/load"
import { formatDecimalMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Насколько срочна группа: красным — то, что горит, жёлтым — деньги и дожим */
const GROUP_TONE: Record<string, string> = {
  miss_tasks: "text-destructive",
  overdue_tasks: "text-destructive",
  leads_without_contact: "text-destructive",
  deals_to_push: "text-warning",
  debts_to_collect: "text-warning",
}

/**
 * «Фокус» менеджера: его записи по приоритету — сначала задачи руководителя по проколам, затем
 * просроченное, дожим, долги, лиды без контакта, встречи без итога и сделки без шага. Правила и
 * порядок — backend (`/team/my-focus/`).
 */
export async function MyFocus() {
  const result = await tryLoad(() => fetchMyFocus())
  if (!result.ok) return <ApiErrorState error={result.error} />
  const focus = result.data
  const groups = focus.groups.filter((group) => group.count > 0)
  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState icon={Target} title="В фокусе пусто" description="Задач по проколам, просрочек, дожима и долгов сейчас нет." />
      </Card>
    )
  }
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <FocusGroup key={group.kind} group={group} today={focus.date} />
      ))}
    </div>
  )
}

function FocusGroup({ group, today }: { group: TodayActionGroup; today: string }) {
  const href = todayGroupHref(group.kind)
  const sums = group.amounts.map((row) => formatDecimalMoney(row.total, row.currency)).join(" · ")
  return (
    <section aria-label={group.title} className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className={cn("inline-flex items-center gap-1 text-sm font-semibold", GROUP_TONE[group.kind])}>
          {group.title} <span className="font-normal text-muted-foreground">{formatNumber(group.count)}</span>
          <MetricHint label={group.title} definition={group.rule} isOpenQuestion={false} />
        </h2>
        {sums && <span className="text-xs text-muted-foreground">{group.kind === "debts_to_collect" ? `к сбору ${sums}` : sums}</span>}
        {href && group.count > group.items.length && (
          <Link href={href} className="text-xs text-primary hover:underline">
            Все {formatNumber(group.count)}
          </Link>
        )}
      </div>
      <ul className="divide-y rounded-xl ring-1 ring-border">
        {group.items.map((item) => {
          const itemHref = todayItemHref(group.kind, item)
          const title = item.title || "Без названия"
          return (
            <li key={item.id} className="px-4 py-2.5 text-sm">
              {itemHref ? (
                <Link href={itemHref} className="font-medium hover:text-primary hover:underline">
                  {title}
                </Link>
              ) : (
                <span className="font-medium">{title}</span>
              )}
              <span className="block text-xs text-muted-foreground">{todayItemMeta(group.kind, item, today).join(" · ")}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
