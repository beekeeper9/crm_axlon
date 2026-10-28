import { CircleCheck, Info, Target } from "lucide-react"
import { cn } from "cn"

import { EmptyState } from "@/components/shared/empty-state"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { focusRepository } from "@/features/focus/api/focus-repository"
import { FocusItemRow } from "@/features/focus/components/focus-item-row"
import { ManagerFilter } from "@/features/focus/components/manager-filter"
import type { FocusGroup } from "@/features/focus/schemas"
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
  const focus = await focusRepository.getFocusList({ managerId })
  const groups = focus.groups.filter((group) => group.items.length > 0)
  const showManager = isTeamView && managerId === null

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
        «Отложить» и «Убрать из фокуса» заработают после подключения backend.
      </p>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="В фокусе пусто"
            description="Приоритетных лидов сейчас нет. Новые появятся, когда ИИ и правила компании отметят их."
          />
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.id} aria-labelledby={`focus-${group.id}`} className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 id={`focus-${group.id}`} className={cn("text-sm font-semibold", GROUP_TITLE_CLASSES[group.tone])}>
                {group.title}{" "}
                <span className="font-normal text-muted-foreground">{formatNumber(group.items.length)}</span>
              </h2>
              {group.description && (
                <p className="text-xs text-muted-foreground">{group.description}</p>
              )}
            </div>
            <ul className="space-y-2">
              {group.items.map((item) => (
                <FocusItemRow
                  key={item.id}
                  item={item}
                  showManager={showManager}
                  isDemoData={isMockDataSource}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
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
