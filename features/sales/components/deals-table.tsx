import Link from "next/link"
import { SearchX } from "lucide-react"
import { cn } from "cn"

import { EmptyState } from "@/components/shared/empty-state"
import { PaginationNav } from "@/components/shared/pagination-nav"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { leadRoute } from "@/config/routes"
import type { Deal, Pipeline, StageKind } from "@/features/sales/schemas"
import type { PageInfo } from "@/lib/api/pagination"
import { formatDateTime, formatDayMonth, formatDecimalMoney } from "@/lib/format"

const STAGE_TONES: Record<StageKind, StatusTone> = { open: "neutral", won: "success", lost: "danger" }

type DealsTableProps = {
  deals: readonly Deal[]
  pipeline: Pipeline
  showManager: boolean
  pageInfo: PageInfo
  hrefForPage: (page: number) => string
}

export function DealsTable({ deals, pipeline, showManager, pageInfo, hrefForPage }: DealsTableProps) {
  if (deals.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title="Сделок не найдено"
          description="Измените поиск или фильтры — например, выберите другой этап или менеджера."
        />
      </Card>
    )
  }

  const stagesById = new Map(pipeline.stages.map((stage) => [stage.id, stage]))

  return (
    <div className="space-y-3">
      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">Сделка</TableHead>
                <TableHead>Этап</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                {showManager && <TableHead>Ответственный</TableHead>}
                <TableHead className="min-w-64">Следующий шаг</TableHead>
                <TableHead className="text-right">Обновлено</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => {
                const stage = stagesById.get(deal.stageId)
                return (
                  <TableRow key={deal.id}>
                    <TableCell>
                      <Link href={leadRoute(deal.id)} className="font-medium hover:text-primary hover:underline">
                        {deal.title}
                      </Link>
                      {deal.client.phone && <p className="text-xs text-muted-foreground">{deal.client.phone}</p>}
                    </TableCell>
                    <TableCell>
                      {stage && <StatusBadge tone={STAGE_TONES[stage.kind]}>{stage.name}</StatusBadge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {deal.amount && deal.currency ? (
                        formatDecimalMoney(deal.amount, deal.currency)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {showManager && (
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <PersonAvatar name={deal.manager.name} />
                          {deal.manager.name}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="whitespace-normal">
                      {deal.nextAction ? (
                        <span className={cn(deal.nextAction.isOverdue && "text-destructive")}>
                          {deal.nextAction.title}
                          {deal.nextAction.dueAt && (
                            <span className={cn("text-xs", !deal.nextAction.isOverdue && "text-muted-foreground")}>
                              {" · "}
                              {formatDateTime(deal.nextAction.dueAt)}
                              {deal.nextAction.isOverdue && " · просрочено"}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-warning">Не назначен</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatDayMonth(deal.updatedAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
      <PaginationNav info={pageInfo} hrefForPage={hrefForPage} />
    </div>
  )
}
