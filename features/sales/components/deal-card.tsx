"use client"

import Link from "next/link"
import { ArrowRight, CircleCheckBig, ExternalLink, GripVertical, MoreHorizontal } from "lucide-react"
import { cn } from "cn"

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
import { formatDateTime, formatDayMonth, formatDecimalMoney } from "@/lib/format"

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
        "group/deal relative space-y-2 rounded-lg border bg-card p-3 transition-[opacity,border-color] hover:border-foreground/20",
        canEdit && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-1">
        {canEdit && (
          <GripVertical
            className="mt-0.5 -ml-1 size-4 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover/deal:opacity-100 max-md:hidden"
            aria-hidden
          />
        )}
        <Link
          href={leadRoute(deal.id)}
          draggable={false}
          className="min-w-0 flex-1 text-sm leading-snug font-medium hover:text-primary focus-visible:text-primary focus-visible:outline-none"
        >
          {deal.title}
        </Link>
        <DealMenu deal={deal} openStages={openStages} canEdit={canEdit} onMove={onMove} onClose={onClose} />
      </div>

      {(deal.amount || deal.tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {deal.amount && deal.currency && (
            <span className="text-sm font-semibold tabular-nums">{formatDecimalMoney(deal.amount, deal.currency)}</span>
          )}
          {deal.tags.map((tag) => (
            <span key={tag} className="rounded bg-muted px-1.5 py-px text-[11px] text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      <NextAction deal={deal} />

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {showManager ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <PersonAvatar name={deal.manager.name} />
            <span className="truncate">{deal.manager.name}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="shrink-0">на этапе с {formatDayMonth(deal.stageEnteredAt)}</span>
      </div>
    </li>
  )
}

function NextAction({ deal }: { deal: Deal }) {
  const next = deal.nextAction
  if (!next) {
    return <p className="text-xs font-medium text-warning">Нет следующего шага</p>
  }
  return (
    <p className={cn("flex items-start gap-1.5 text-xs", next.isOverdue ? "text-destructive" : "text-muted-foreground")}>
      <ArrowRight className="mt-px size-3 shrink-0" aria-hidden />
      <span>
        <span className={cn(!next.isOverdue && "text-foreground/90")}>{next.title}</span>
        {next.dueAt && ` · ${formatDateTime(next.dueAt)}`}
        {next.isOverdue && <span className="font-medium"> · просрочено</span>}
      </span>
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
            className="-mt-0.5 -mr-1 shrink-0 text-muted-foreground"
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
