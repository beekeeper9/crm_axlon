import { CircleCheck, Info, Target } from "lucide-react"
import { cn } from "@/lib/utils"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { focusRepository } from "@/features/focus/api/focus-repository"
import { FocusItemRow } from "@/features/focus/components/focus-item-row"
import { MyFocus } from "@/features/focus/components/my-focus"
import { ManagerFilter } from "@/features/focus/components/manager-filter"
import type { FocusGroup, FocusList } from "@/features/focus/schemas"
import { fetchTeamPlanFact, type TeamPlanFact } from "@/features/team-cabinet/api/team-board"
import { tryLoad } from "@/lib/api/load"
import { formatNumber } from "@/lib/format"

const GROUP_TITLE_CLASSES: Record<FocusGroup["tone"], string> = {
  urgent: "text-destructive",
  warm: "text-warning",
  neutral: "text-foreground",
}

type FocusViewProps = {
  /** Руководитель видит команду и фильтр по менеджерам */
  isTeamView: boolean
  managerId: string | null
}

export async function FocusView({ isTeamView, managerId }: FocusViewProps) {
  // Менеджер в режиме api — свой «Фокус» по приоритетам: проколы, просрочки, дожим, долги…
  if (!isTeamView && !isMockDataSource) return <MyFocus />
  const byManager = isTeamView && managerId === null
  const [loaded, planFact] = await Promise.all([
    tryLoad(() => focusRepository.getFocusList({ managerId })),
    // План — только руководителю и только в режиме api; без него блоки идут без процента
    isTeamView && !isMockDataSource ? tryLoad(fetchTeamPlanFact) : Promise.resolve(null),
  ])
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const focus = loaded.data
  const groups = focus.groups.filter((group) => group.items.length > 0)
  const plans = planFact?.ok ? planFact.data : null

  return (
    <div className="space-y-5">
      {isTeamView && <ManagerFilter managers={focus.managers} selectedId={managerId} />}

      {focus.awaitingReply === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
          <CircleCheck className="size-4" aria-hidden />
          Никто не ждёт ответа — всем ответили
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Info className="size-3.5" aria-hidden />
        {isMockDataSource
          ? "«Отложить» и «Убрать из фокуса» заработают после подключения backend."
          : "Список собирает сервер по правилам компании: что просрочено, без следующего шага или без движения. Запись уходит из фокуса, когда проблема решена."}
      </p>
      {focus.truncated && (
        <p className="text-meta text-warning">Показаны не все записи: сервер ограничил ответ. Начните со старых — они вверху.</p>
      )}

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="В фокусе пусто"
            description="Просроченных задач, забытых лидов и сделок без шага сейчас нет."
          />
        </Card>
      ) : byManager ? (
        <ManagerBlocks focus={focus} groups={groups} plans={plans} />
      ) : (
        <>
          {isTeamView && managerId && <PlanLine plans={plans} managerId={managerId} />}
          <Groups groups={groups} showManager={false} />
        </>
      )}
    </div>
  )
}

/** Руководителю — по менеджерам: у кого больше записей, тот выше; у каждого — выполнение плана */
function ManagerBlocks({ focus, groups, plans }: { focus: FocusList; groups: readonly FocusGroup[]; plans: TeamPlanFact | null }) {
  const managers = [...focus.managers].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru"))
  return (
    <ol className="space-y-4">
      {managers.map((manager) => {
        const own = groups
          .map((group) => ({ ...group, items: group.items.filter((item) => item.manager.id === manager.id) }))
          .filter((group) => group.items.length > 0)
        return (
          <li key={manager.id}>
            <section aria-labelledby={`focus-manager-${manager.id}`} className="space-y-3 rounded-xl px-4 py-3 ring-1 ring-border">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`focus-manager-${manager.id}`} className="text-base font-semibold">
                  {manager.name} <span className="text-sm font-normal text-muted-foreground">· в фокусе {formatNumber(manager.count)}</span>
                </h2>
              </div>
              <PlanLine plans={plans} managerId={manager.id} />
              {own.length === 0 ? (
                <p className="text-sm text-muted-foreground">Срочного нет.</p>
              ) : (
                <Groups groups={own} showManager={false} />
              )}
            </section>
          </li>
        )
      })}
    </ol>
  )
}

/** Выполнение личного плана продаж за месяц (считает backend) */
function PlanLine({ plans, managerId }: { plans: TeamPlanFact | null; managerId: string }) {
  const row = plans?.rows.find((item) => item.userId === managerId)
  if (!row) return null
  const plan = Number(row.planSales)
  if (!(plan > 0)) return <p className="text-meta text-muted-foreground">План продаж на месяц не задан · продаж: {formatNumber(row.salesActual)}</p>
  const percent = Math.round((row.salesActual / plan) * 100)
  const width = Math.min(Math.max(percent, 0), 100)
  return (
    <div className="space-y-1">
      <p className="flex justify-between gap-2 text-meta text-muted-foreground">
        <span>План продаж на месяц</span>
        <span className="tabular-nums">
          {formatNumber(row.salesActual)} из {formatNumber(plan)} · <span className="font-medium text-foreground">{formatNumber(percent)}%</span>
        </span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Выполнение плана продаж" aria-valuemin={0} aria-valuemax={100} aria-valuenow={width}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function Groups({ groups, showManager }: { groups: readonly FocusGroup[]; showManager: boolean }) {
  return groups.map((group) => (
    <section key={group.id} aria-label={group.title} className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 className={cn("text-sm font-semibold", GROUP_TITLE_CLASSES[group.tone])}>
          {group.title} <span className="font-normal text-muted-foreground">{formatNumber(group.items.length)}</span>
        </h3>
        {group.description && <p className="text-xs text-muted-foreground">{group.description}</p>}
      </div>
      <ul className="space-y-2">
        {group.items.map((item) => (
          <FocusItemRow key={item.id} item={item} showManager={showManager} isDemoData={isMockDataSource} />
        ))}
      </ul>
    </section>
  ))
}

export function FocusViewSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Загрузка фокуса">
      <Skeleton className="h-8 w-full max-w-xl" />
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  )
}
