"use client"

import Link from "next/link"
import { CalendarClock, CircleCheckBig, CircleDashed, ExternalLink, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

import { PersonAvatar } from "@/components/shared/person-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { leadRoute } from "@/config/routes"
import type { Deal, PipelineStage } from "@/features/sales/schemas"
import { formatDateTime, formatDecimalMoney } from "@/lib/format"

type DealCardProps = {
  deal: Deal
  openStages: readonly PipelineStage[]
  showManager: boolean
  canEdit: boolean
  isDragging: boolean
  onDragStart: (dealId: string) => void
  onDragEnd: () => void
  onMove: (dealId: string, stageId: string) => void
  onClose: (deal: Deal) => void
}

export function DealCard({
  deal,
  openStages,
  showManager,
  canEdit,
  isDragging,
  onDragStart,
  onDragEnd,
  onMove,
  onClose,
}: DealCardProps) {
  const tag = deal.tags[0]
  return (
    <li
      draggable={canEdit}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", deal.id)
        event.dataTransfer.effectAllowed = "move"
        onDragStart(deal.id)
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group/deal relative space-y-1.5 rounded-lg bg-card px-3 py-2.5 ring-1 ring-border transition-[box-shadow,opacity] hover:ring-foreground/20 focus-within:ring-ring/60",
        canEdit && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-1">
        {/* Ссылка растянута на всю карточку; меню лежит поверх неё */}
        <Link
          href={leadRoute(deal.id)}
          draggable={false}
          className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-medium after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
        >
          {deal.title}
        </Link>
        <DealMenu deal={deal} openStages={openStages} canEdit={canEdit} onMove={onMove} onClose={onClose} />
      </div>

      <NextAction deal={deal} />

      <div className="flex items-center gap-2">
        <span className={cn("text-meta tabular-nums", deal.amount ? "font-semibold" : "text-muted-foreground")}>
          {deal.amount && deal.currency ? formatDecimalMoney(deal.amount, deal.currency) : "Без суммы"}
        </span>
        {tag && <span className="truncate rounded bg-muted px-1.5 text-[11px] leading-4 text-muted-foreground">{tag}</span>}
        {showManager && <PersonAvatar name={deal.manager.name} className="ml-auto" />}
      </div>
    </li>
  )
}

function NextAction({ deal }: { deal: Deal }) {
  const next = deal.nextAction
  if (!next) {
    return (
      <p className="flex items-center gap-1.5 text-meta text-warning">
        <CircleDashed className="size-3.5 shrink-0" aria-hidden />
        Нет следующего шага
      </p>
    )
  }
  return (
    <p className={cn("flex min-w-0 items-center gap-1.5 text-meta", next.isOverdue ? "text-destructive" : "text-muted-foreground")}>
      <CalendarClock className="size-3.5 shrink-0" aria-hidden />
      {next.dueAt && (
        <span className="shrink-0 tabular-nums">
          {next.isOverdue && <span className="sr-only">Просрочено: </span>}
          {formatDateTime(next.dueAt)}
        </span>
      )}
      <span className={cn("truncate", !next.isOverdue && "text-foreground/85")}>{next.title}</span>
    </p>
  )
}

type DealMenuProps = Pick<DealCardProps, "deal" | "openStages" | "canEdit" | "onMove" | "onClose">

/** Меню действий: доступно с клавиатуры и на сенсорных экранах, где перетаскивание неудобно */
function DealMenu({ deal, openStages, canEdit, onMove, onClose }: DealMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="relative z-10 -mt-0.5 -mr-1.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/deal:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
            aria-label={`Действия: ${deal.title}`}
          />
        }
      >
        <MoreHorizontal aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem render={<Link href={leadRoute(deal.id)} />}>
          <ExternalLink aria-hidden />
          Открыть карточку
        </DropdownMenuItem>
        {canEdit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Сменить этап</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-60">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Этап воронки</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={deal.stageId} onValueChange={(stageId: string) => onMove(deal.id, stageId)}>
                    {openStages.map((stage) => (
                      <DropdownMenuRadioItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={() => onClose(deal)}>
              <CircleCheckBig aria-hidden />
              Закрыть сделку…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
