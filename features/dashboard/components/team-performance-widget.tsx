import { Users } from "lucide-react"
import { cn } from "cn"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { WidgetCard } from "@/components/shared/widget-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { dashboardRepository } from "@/features/dashboard/api/dashboard-repository"
import { PlanProgressBar } from "@/features/dashboard/components/plan-progress-bar"
import {
  expectedProgress,
  PACE_STATUS_META,
  paceStatus,
} from "@/features/dashboard/lib/plan-pace"
import {
  formatInitials,
  formatMoney,
  formatNumber,
  formatPercent,
} from "@/lib/format"

export const TEAM_PERFORMANCE_TITLE = "Эффективность менеджеров"

export async function TeamPerformanceWidget() {
  const { period, members } = await dashboardRepository.getTeamPerformance()
  const expected = expectedProgress(period)

  const rows = members
    .map((member) => ({
      ...member,
      ratio: member.plan === 0 ? 0 : member.actual / member.plan,
      status: paceStatus(member.actual, member.plan, period),
    }))
    .sort((a, b) => b.ratio - a.ratio)

  return (
    <WidgetCard
      title={TEAM_PERFORMANCE_TITLE}
      description={`${period.label} · ожидаемый темп на сегодня ${formatPercent(expected)} плана`}
      contentClassName="px-0"
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="В отделе пока нет менеджеров"
          description="Показатели появятся, когда в отдел добавят сотрудников с планом продаж."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Менеджер</TableHead>
              <TableHead className="w-full min-w-52">Выручка и план</TableHead>
              <TableHead className="text-right">Сделки</TableHead>
              <TableHead className="text-right">Конверсия</TableHead>
              <TableHead className="text-right">Просрочки</TableHead>
              <TableHead className="pr-4">Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const status = PACE_STATUS_META[row.status]
              return (
                <TableRow key={row.managerId}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarFallback>{formatInitials(row.managerName)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{row.managerName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span>
                          <span className="font-medium text-foreground">
                            {formatMoney(row.actual)}
                          </span>
                          <span className="text-muted-foreground"> из {formatMoney(row.plan)}</span>
                        </span>
                        <span className="font-medium">{formatPercent(row.ratio)}</span>
                      </div>
                      <PlanProgressBar
                        ratio={row.ratio}
                        expectedRatio={expected}
                        status={row.status}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(row.wonDeals)}</TableCell>
                  <TableCell className="text-right">{formatPercent(row.conversionRate)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right",
                      row.overdueTasks > 0 ? "font-medium text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {formatNumber(row.overdueTasks)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </WidgetCard>
  )
}
