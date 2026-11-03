import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { MetricHint } from "@/components/shared/metric-hint"
import { fetchTodayActions, type TodayActionGroup, type TodayActions } from "@/features/team-cabinet/api/today-actions"
import { CabinetSection } from "@/features/team-cabinet/components/cabinet-parts"
import { todayGroupHref, todayItemHref, todayItemMeta } from "@/features/team-cabinet/lib/today-actions"
import { tryLoad } from "@/lib/api/load"
import { formatDecimalMoney, formatNumber, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Группы, где непустой счётчик — сигнал «нужно вмешаться» (остальные — «стоит заняться») */
const URGENT = new Set(["payments_to_verify", "overdue_tasks", "meetings_without_outcome", "leads_without_contact"])

/**
 * «Что делать сегодня» — верх кабинета РОПа и директора. Только правила backend, без ИИ:
 * РОП видит свой отдел, директор — компанию (или отдел, если он выбран).
 */
export async function TodayActionsSection({ departmentId }: { departmentId?: string | null }) {
  const result = await tryLoad(() => fetchTodayActions(departmentId))
  if (!result.ok) {
    return (
      <CabinetSection id="today-actions" title="Что делать сегодня">
        <ApiErrorState error={result.error} bare />
      </CabinetSection>
    )
  }
  return <TodayActionsView actions={result.data} />
}

function TodayActionsView({ actions }: { actions: TodayActions }) {
  return (
    <CabinetSection
      id="today-actions"
      title="Что делать сегодня"
      description={
        actions.total === 0
          ? `Данные на ${formatTime(actions.asOf)} · срочных дел нет`
          : `Данные на ${formatTime(actions.asOf)} · всего дел: ${formatNumber(actions.total)} · по порядку важности`
      }
    >
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {actions.groups.map((group) => (
          <li key={group.kind}>
            <ActionGroupCard group={group} today={actions.date} />
          </li>
        ))}
      </ol>
    </CabinetSection>
  )
}

function ActionGroupCard({ group, today }: { group: TodayActionGroup; today: string }) {
  const groupHref = todayGroupHref(group.kind)
  const hidden = group.count - group.items.length
  const tone = group.count === 0 ? "text-muted-foreground" : URGENT.has(group.kind) ? "text-destructive" : "text-warning"
  return (
    <article aria-label={group.title} className="flex h-full flex-col gap-2 rounded-xl px-3 py-2.5 ring-1 ring-border">
      <header className="flex items-start justify-between gap-2">
        <h3 className="inline-flex items-center gap-1 text-sm font-medium">
          {group.title}
          <MetricHint label={group.title} definition={group.rule} />
        </h3>
        <span className={cn("text-lg font-semibold tabular-nums", tone)}>{formatNumber(group.count)}</span>
      </header>
      {group.amounts.length > 0 && (
        <p className="text-meta text-muted-foreground tabular-nums">
          {group.kind === "deals_to_push" ? "Долг: " : "Сумма: "}
          {group.amounts.map((row) => formatDecimalMoney(row.total, row.currency)).join(" · ")}
        </p>
      )}
      {group.count === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" aria-hidden />
          Всё в порядке
        </p>
      ) : (
        <ul className="space-y-1.5">
          {group.items.map((item) => {
            const href = todayItemHref(group.kind, item)
            const title = (group.kind === "managers_without_activity" ? item.managerName : null) ?? (item.title || "Без названия")
            const meta = todayItemMeta(group.kind, item, today)
            return (
              <li key={item.id} className="text-sm leading-snug">
                {href ? (
                  <Link href={href} className="font-medium hover:text-primary hover:underline">
                    {title}
                  </Link>
                ) : (
                  <span className="font-medium">{title}</span>
                )}
                <span className="block text-xs text-muted-foreground">
                  {[group.kind === "managers_without_activity" ? null : item.managerName, ...meta].filter(Boolean).join(" · ")}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {group.count > 0 && group.byManager.length > 1 && group.kind !== "managers_without_activity" && (
        <p className="text-xs text-muted-foreground">
          По менеджерам: {group.byManager.map((row) => `${row.name} ${formatNumber(row.count)}`).join(", ")}
        </p>
      )}
      {groupHref && group.count > 0 && (
        <Link href={groupHref} className="mt-auto text-xs text-primary hover:underline">
          {hidden > 0 ? `Ещё ${formatNumber(hidden)} — открыть все` : "Открыть"}
        </Link>
      )}
    </article>
  )
}
