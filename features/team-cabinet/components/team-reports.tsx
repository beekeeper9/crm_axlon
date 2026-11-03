import Link from "next/link"
import { Download } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { ListPanel } from "@/components/shared/list-panel"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { buttonVariants } from "@/components/ui/button"
import { routes, teamMemberRoute } from "@/config/routes"
import { fetchDepartments, fetchTeamReport, REPORT_PERIODS, type ReportPeriod, type TeamReport } from "@/features/team-cabinet/api/team-board"
import { NumLink } from "@/features/team-cabinet/components/cabinet-parts"
import { tryLoad } from "@/lib/api/load"
import { formatDayMonth, formatDecimal, formatNumber, formatPercent } from "@/lib/format"
import { getParam, hrefWithParams, type SearchParamsRecord } from "@/lib/search-params"

const PERIOD_LABELS: Record<ReportPeriod, string> = { day: "День", week: "Неделя", month: "Месяц" }

const th = "px-3 py-2 text-right font-medium text-muted-foreground"
const td = "px-3 py-2 text-right tabular-nums"

/**
 * Отчёты отдела за день, неделю и месяц по данным CRM (те же определения, что в кабинете).
 * РОП видит свой отдел, директор — любой отдел или всю компанию.
 */
export async function TeamReportsView({ params, canPickDepartment }: { params: SearchParamsRecord; canPickDepartment: boolean }) {
  const periodParam = getParam(params, "period")
  const period: ReportPeriod = REPORT_PERIODS.find((item) => item === periodParam) ?? "day"
  const date = getParam(params, "date")
  const departmentId = canPickDepartment ? getParam(params, "department") : null
  const href = (patch: Record<string, string | null>) => hrefWithParams(routes.dailyReports, params, patch)

  const [report, departments] = await Promise.all([
    tryLoad(() => fetchTeamReport(period, date, departmentId)),
    canPickDepartment ? tryLoad(fetchDepartments) : Promise.resolve(null),
  ])
  const csv = `/exports/team-report?${new URLSearchParams({
    period,
    ...(date ? { date } : {}),
    ...(departmentId ? { department_id: departmentId } : {}),
  }).toString()}`

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Отчёты</h1>
          <p className="text-meta text-muted-foreground">
            Итоги менеджеров за день, неделю и месяц. Числа считает сервер по данным CRM.
          </p>
        </div>
        <a href={csv} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Download data-icon="inline-start" aria-hidden />
          Скачать CSV
        </a>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <SegmentedLinks
          label="Период"
          variant="pill"
          items={REPORT_PERIODS.map((item) => ({ key: item, label: PERIOD_LABELS[item], href: href({ period: item === "day" ? null : item }), isActive: item === period }))}
        />
        <form className="flex items-end gap-2" action={routes.dailyReports}>
          <input type="hidden" name="period" value={period} />
          {departmentId && <input type="hidden" name="department" value={departmentId} />}
          <input type="date" name="date" defaultValue={date ?? (report.ok ? report.data.dateTo : "")} aria-label="Дата" className="h-8 rounded-md border bg-background px-2 text-sm" />
          <button type="submit" className="h-8 rounded-md px-3 text-sm ring-1 ring-border hover:bg-muted">
            Показать
          </button>
        </form>
        {departments?.ok && departments.data.length > 0 && (
          <SegmentedLinks
            label="Отдел"
            variant="pill"
            items={[
              { key: "all", label: "Вся компания", href: href({ department: null }), isActive: departmentId === null },
              ...departments.data.map((department) => ({
                key: department.id,
                label: department.name,
                href: href({ department: department.id }),
                isActive: department.id === departmentId,
              })),
            ]}
          />
        )}
      </div>

      {report.ok ? <ReportTable report={report.data} /> : <ApiErrorState error={report.error} />}
    </div>
  )
}

function ReportTable({ report }: { report: TeamReport }) {
  const range = report.dateFrom === report.dateTo ? formatDayMonth(report.dateFrom) : `${formatDayMonth(report.dateFrom)} — ${formatDayMonth(report.dateTo)}`
  if (report.rows.length === 0) return <p className="text-sm text-muted-foreground">В отделе пока нет сотрудников.</p>
  const totals = report.totals
  return (
    <section aria-label={`Отчёт за ${range}`} className="space-y-2">
      <p className="text-meta text-muted-foreground">
        Период: {range}. Хвосты CRM и план — на текущий момент; продажи — сделки, первая оплата по которым попала в период.
      </p>
      <ListPanel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[72rem] text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Сотрудник</th>
                <th className={th}>Встреч</th>
                <th className={th}>Состоялось</th>
                <th className={th}>Не пришли</th>
                <th className={th}>Доходимость</th>
                <th className={th}>Звонки</th>
                <th className={th}>Продажи</th>
                <th className={th}>Оплаты</th>
                <th className={th}>Сумма оплат</th>
                <th className={th}>Предоплаты</th>
                <th className={th}>Задачи выполнены</th>
                <th className={th}>Просрочено</th>
                <th className={th}>Без итога</th>
                <th className={th}>Без шага</th>
                <th className={th}>План месяца</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.rows.map((row) => (
                <tr key={row.userId}>
                  <td className="px-3 py-2">
                    <Link href={teamMemberRoute(row.userId)} className="font-medium hover:text-primary hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className={td}>{formatNumber(row.meetingsBooked)}</td>
                  <td className={td}>{formatNumber(row.meetingsHeld)}</td>
                  <td className={td}>{formatNumber(row.meetingsNoShow)}</td>
                  <td className={td}>{row.attendance === null ? "—" : formatPercent(Number(row.attendance))}</td>
                  <td className={td}>{formatNumber(row.calls)}</td>
                  <td className={td}>{formatNumber(row.sales)}</td>
                  <td className={td}>{formatNumber(row.paymentsCount)}</td>
                  <td className={td}>{formatDecimal(Number(row.received))}</td>
                  <td className={td}>{formatNumber(row.prepayments)}</td>
                  <td className={td}>{formatNumber(row.tasksDone)}</td>
                  <td className={td}><NumLink value={row.overdueTasks} tone="danger" /></td>
                  <td className={td}><NumLink value={row.meetingsWithoutOutcome} tone="danger" /></td>
                  <td className={td}><NumLink value={row.dealsWithoutNextStep} tone="warning" /></td>
                  <td className={td}>
                    {formatNumber(row.monthSales)}
                    {row.planSales === null ? <span className="text-muted-foreground"> / не задан</span> : ` / ${formatDecimal(Number(row.planSales))}`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t font-medium">
              <tr>
                <td className="px-3 py-2">Итого · {formatNumber(report.rows.length)}</td>
                <td className={td}>{formatNumber(totals.meetingsBooked)}</td>
                <td className={td}>{formatNumber(totals.meetingsHeld)}</td>
                <td className={td}>{formatNumber(totals.meetingsNoShow)}</td>
                <td className={td}>{totals.attendance === null ? "—" : formatPercent(Number(totals.attendance))}</td>
                <td className={td}>{formatNumber(totals.calls)}</td>
                <td className={td}>{formatNumber(totals.sales)}</td>
                <td className={td}>{formatNumber(totals.paymentsCount)}</td>
                <td className={td}>{formatDecimal(Number(totals.received))}</td>
                <td className={td}>{formatNumber(totals.prepayments)}</td>
                <td className={td}>{formatNumber(totals.tasksDone)}</td>
                <td className={td} colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      </ListPanel>
    </section>
  )
}
