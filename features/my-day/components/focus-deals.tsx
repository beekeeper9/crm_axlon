import Link from "next/link"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { leadRoute, routes } from "@/config/routes"
import { focusRepository, type FocusItem } from "@/features/focus"
import { tryLoad } from "@/lib/api/load"
import { formatDateTime, formatDecimalMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Сколько сделок показываем на главной; полный список — в «Фокусе» */
const LIMIT = 5

const PRIORITY_ORDER: Record<FocusItem["priority"], number> = { high: 0, medium: 1, low: 2 }

/** «Сделки в приоритете»: короткий список из «Фокуса» с причиной и следующим шагом. Отбор делает backend */
export async function FocusDeals({ userId }: { userId: string }) {
  const result = await tryLoad(() => focusRepository.getFocusList({ managerId: userId }))
  if (!result.ok) return <ApiErrorState error={result.error} />
  const all = result.data.groups.flatMap((group) => group.items)
  const items = all.toSorted((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]).slice(0, LIMIT)

  return (
    <section aria-labelledby="focus-deals" className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <header className="flex items-baseline justify-between gap-2 px-4 pt-4 pb-3">
        <h2 id="focus-deals" className="text-base font-semibold">Сделки в приоритете</h2>
        <Link href={routes.focus} className="text-meta text-primary hover:underline">
          Весь фокус · {formatNumber(all.length)} →
        </Link>
      </header>
      {items.length === 0 ? (
        <p className="border-t px-4 py-6 text-meta text-muted-foreground">Сделок, требующих внимания, нет.</p>
      ) : (
        <ul className="divide-y divide-border/60 border-t">
          {items.map((item) => (
            <li key={item.id} className="relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40 focus-within:bg-accent/40">
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  item.priority === "high" ? "bg-destructive" : item.priority === "medium" ? "bg-warning" : "bg-muted-foreground/50"
                )}
                aria-label={item.priority === "high" ? "Высокий приоритет" : item.priority === "medium" ? "Средний приоритет" : "Низкий приоритет"}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <Link href={leadRoute(item.lead.id)} className="truncate text-sm font-medium after:absolute after:inset-0 focus-visible:outline-none">
                    {item.lead.name}
                  </Link>
                  <span className="shrink-0 text-meta font-medium tabular-nums">
                    {item.amount && item.currency ? formatDecimalMoney(item.amount, item.currency) : ""}
                  </span>
                </div>
                <p className="text-meta text-muted-foreground">
                  {item.stageName} · <span className={cn(item.priority === "high" && "text-warning")}>{item.reason.label}</span>
                </p>
                <p className={cn("truncate text-meta", item.nextAction ? "text-foreground/85" : "text-warning")}>
                  {item.nextAction
                    ? `${item.nextAction.title}${item.nextAction.dueAt ? ` · ${formatDateTime(item.nextAction.dueAt)}` : ""}`
                    : "Следующий шаг не назначен"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function FocusDealsSkeleton() {
  return <Skeleton className="h-64 w-full rounded-xl" aria-busy="true" />
}
