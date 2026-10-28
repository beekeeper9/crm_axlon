import Link from "next/link"
import { ArrowDown, ArrowUp, ArrowUpDown, SearchX } from "lucide-react"
import { cn } from "@/lib/utils"

import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { PaginationNav } from "@/components/shared/pagination-nav"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge"
import { leadRoute } from "@/config/routes"
import type { DealSort } from "@/features/sales/api/sales-repository"
import type { Deal, Pipeline, StageKind } from "@/features/sales/schemas"
import type { PageInfo } from "@/lib/api/pagination"
import { formatDateTime, formatDayMonth, formatDecimalMoney } from "@/lib/format"
import type { ParamPatch } from "@/lib/search-params"

const STAGE_TONES: Record<StageKind, StatusTone> = { open: "neutral", won: "success", lost: "danger" }

type SortableColumn = { asc: DealSort; desc: DealSort | null }

const SORTABLE = {
  title: { asc: "title", desc: null },
  amount: { asc: "amount", desc: "-amount" },
  next: { asc: "next_action", desc: null },
  updated: { asc: "updated", desc: "-updated" },
} satisfies Record<string, SortableColumn>

type DealsTableProps = {
  deals: readonly Deal[]
  pipelines: readonly Pipeline[]
  /** В «Списке» сделки из разных воронок — показываем воронку рядом с этапом */
  showPipeline: boolean
  showManager: boolean
  pageInfo: PageInfo
  sort: DealSort
  hrefFor: (patch: ParamPatch) => string
  emptyDescription: string
}

function SortHeader({
  label,
  column,
  sort,
  hrefFor,
  align = "left",
}: {
  label: string
  column: SortableColumn
  sort: DealSort
  hrefFor: DealsTableProps["hrefFor"]
  align?: "left" | "right"
}) {
  const isAsc = sort === column.asc
  const isDesc = column.desc !== null && sort === column.desc
  // Повторный клик переворачивает порядок; у колонок без обратного порядка — возвращает по умолчанию
  const next = isAsc ? (column.desc ?? "-updated") : (column.desc ?? column.asc)
  const Icon = isAsc ? ArrowUp : isDesc ? ArrowDown : ArrowUpDown
  return (
    <th
      scope="col"
      aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}
      className={cn("h-9 px-3 font-medium whitespace-nowrap", align === "right" && "text-right")}
    >
      <Link
        href={hrefFor({ sort: next === "-updated" ? null : next })}
        scroll={false}
        className={cn(
          "inline-flex items-center gap-1 rounded hover:text-foreground",
          (isAsc || isDesc) && "text-foreground"
        )}
      >
        {label}
        <Icon className={cn("size-3", !(isAsc || isDesc) && "opacity-40")} aria-hidden />
      </Link>
    </th>
  )
}

/** Таблица сделок: плотные строки, закреплённая шапка, сортировка и переход в карточку лида */
export function DealsTable({
  deals,
  pipelines,
  showPipeline,
  showManager,
  pageInfo,
  sort,
  hrefFor,
  emptyDescription,
}: DealsTableProps) {
  if (deals.length === 0) {
    return (
      <ListPanel>
        <EmptyState icon={SearchX} title="Сделок не найдено" description={emptyDescription} />
      </ListPanel>
    )
  }

  const stages = new Map(
    pipelines.flatMap((pipeline) => pipeline.stages.map((stage) => [stage.id, { stage, pipelineName: pipeline.name }] as const))
  )

  return (
    <div className="space-y-3">
      <ListPanel>
        <div className="max-h-[calc(100svh-14rem)] overflow-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="sticky top-0 z-10 bg-card text-left text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
              <tr>
                <SortHeader label="Клиент и сделка" column={SORTABLE.title} sort={sort} hrefFor={hrefFor} />
                <th scope="col" className="h-9 px-3 font-medium">Этап</th>
                <SortHeader label="Сумма" column={SORTABLE.amount} sort={sort} hrefFor={hrefFor} align="right" />
                {showManager && <th scope="col" className="h-9 px-3 font-medium">Ответственный</th>}
                <SortHeader label="Следующий шаг" column={SORTABLE.next} sort={sort} hrefFor={hrefFor} />
                <SortHeader label="Обновлено" column={SORTABLE.updated} sort={sort} hrefFor={hrefFor} align="right" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {deals.map((deal) => {
                const stageInfo = stages.get(deal.stageId)
                return (
                  <tr key={deal.id} className="group/row relative transition-colors hover:bg-accent/50 focus-within:bg-accent/50">
                    <td className="max-w-80 px-3 py-2">
                      {/* Ссылка растянута на всю строку: строку можно открыть кликом в любом месте */}
                      <Link
                        href={leadRoute(deal.id)}
                        className="block truncate font-medium after:absolute after:inset-0 focus-visible:outline-none"
                      >
                        {deal.title}
                      </Link>
                      {deal.client.phone && <p className="text-meta text-muted-foreground tabular-nums">{deal.client.phone}</p>}
                    </td>
                    <td className="px-3 py-2">
                      {stageInfo && (
                        <div className="space-y-0.5">
                          <StatusBadge tone={STAGE_TONES[stageInfo.stage.kind]}>{stageInfo.stage.name}</StatusBadge>
                          {showPipeline && <p className="text-xs text-muted-foreground">{stageInfo.pipelineName}</p>}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums">
                      {deal.amount && deal.currency ? (
                        formatDecimalMoney(deal.amount, deal.currency)
                      ) : (
                        <span className="font-normal text-muted-foreground">—</span>
                      )}
                    </td>
                    {showManager && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="flex items-center gap-2 text-meta">
                          <PersonAvatar name={deal.manager.name} />
                          {deal.manager.name}
                        </span>
                      </td>
                    )}
                    <td className="max-w-72 px-3 py-2">
                      {deal.nextAction ? (
                        <div className="min-w-0">
                          <p className="truncate">{deal.nextAction.title}</p>
                          {deal.nextAction.dueAt && (
                            <p className={cn("text-meta", deal.nextAction.isOverdue ? "text-destructive" : "text-muted-foreground")}>
                              {deal.nextAction.isOverdue && "Просрочено · "}
                              {formatDateTime(deal.nextAction.dueAt)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-meta text-warning">Не назначен</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-meta whitespace-nowrap text-muted-foreground">
                      {formatDayMonth(deal.updatedAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </ListPanel>
      <PaginationNav info={pageInfo} hrefForPage={(page) => hrefFor({ page: page > 1 ? String(page) : null })} />
    </div>
  )
}
