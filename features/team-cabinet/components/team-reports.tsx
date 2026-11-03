import Link from "next/link"
import { Download } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { routes, teamMemberRoute } from "@/config/routes"
import { fetchDepartments, fetchTeamReport, REPORT_PERIODS, type ReportPeriod, type TeamReport } from "@/features/team-cabinet/api/team-board"
import { NumLink } from "@/features/team-cabinet/components/cabinet-parts"
import { tryLoad } from "@/lib/api/load"
import { formatDayMonth, formatDecimal, formatNumber, formatPercent, pluralize } from "@/lib/format"
import { getParam, hrefWithParams, type SearchParamsRecord } from "@/lib/search-params"
import { cn } from "@/lib/utils"
import { cabinetMoney } from "@/features/team-cabinet/lib/money"

const PERIOD_LABELS: Record<ReportPeriod, string> = { day: "День", week: "Неделя", month: "Месяц" }

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

type ReportRow = TeamReport["rows"][number]

const percent = (value: string | null) => (value === null ? "—" : formatPercent(Number(value)))

/** Итоги отдела — плитками над карточками; затем по карточке на сотрудника */
function ReportTable({ report }: { report: TeamReport }) {
  const range = report.dateFrom === report.dateTo ? formatDayMonth(report.dateFrom) : `${formatDayMonth(report.dateFrom)} — ${formatDayMonth(report.dateTo)}`
  if (report.rows.length === 0) return <p className="text-sm text-muted-foreground">В отделе пока нет сотрудников.</p>
  const totals = report.totals
  const withTails = report.rows.filter(hasTails).length

  return (
    <div className="space-y-6">
      <section aria-labelledby="report-summary" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="report-summary" className="text-base font-semibold">
            Итоги за {range}
          </h2>
          <p className="text-meta text-muted-foreground">
            {formatNumber(report.rows.length)} {pluralize(report.rows.length, ["сотрудник", "сотрудника", "сотрудников"])}
            {withTails > 0 ? ` · с хвостами CRM: ${formatNumber(withTails)}` : " · хвостов CRM нет"}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryTile label="Встреч назначено" value={formatNumber(totals.meetingsBooked)} />
          <SummaryTile label="Состоялось" value={formatNumber(totals.meetingsHeld)} note={`доходимость ${percent(totals.attendance)}`} />
          <SummaryTile label="Продажи" value={formatNumber(totals.sales)} note={`встреча → продажа ${percent(totals.meetingToSale)}`} />
          <SummaryTile label="Оплаты" value={formatNumber(totals.paymentsCount)} note={`предоплат ${formatNumber(totals.prepayments)}`} />
          <SummaryTile label="Получено" value={cabinetMoney(totals.received, report.currency)} />
          <SummaryTile label="Задач выполнено" value={formatNumber(totals.tasksDone)} note={`звонков ${formatNumber(totals.calls)}`} />
        </dl>
        <p className="text-meta text-muted-foreground">
          Продажи — сделки, первая оплата по которым попала в период. Хвосты CRM и план месяца — на текущий момент.
        </p>
      </section>

      <section aria-labelledby="report-people" className="space-y-3">
        <h2 id="report-people" className="text-base font-semibold">
          По сотрудникам
        </h2>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {report.rows.map((row) => (
            <PersonCard key={row.userId} row={row} currency={report.currency} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function SummaryTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-muted/40 px-4 py-3 ring-1 ring-border">
      <dt className="text-meta text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  )
}

const hasTails = (row: ReportRow) =>
  row.overdueTasks + row.meetingsWithoutOutcome + row.dealsWithoutNextStep + row.reschedulesWithoutDate > 0

function PersonCard({ row, currency }: { row: ReportRow; currency: string | null }) {
  const plan = row.planSales === null ? null : Number(row.planSales)
  const progress = plan && plan > 0 ? Math.min(row.monthSales / plan, 1) : null
  const tails = hasTails(row)

  return (
    <li className={cn("space-y-4 rounded-xl bg-card p-4 ring-1", tails ? "ring-warning/40" : "ring-border")}>
      <div className="flex items-start justify-between gap-3">
        <Link href={teamMemberRoute(row.userId)} className="min-w-0 truncate font-semibold hover:text-primary hover:underline">
          {row.name}
        </Link>
        <StatusBadge tone={tails ? "warning" : "success"}>{tails ? "Есть хвосты" : "Всё заполнено"}</StatusBadge>
      </div>

      <div className="space-y-1.5">
        <p className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">План месяца</span>
          <span className="tabular-nums">
            {formatNumber(row.monthSales)}
            {plan === null ? <span className="text-muted-foreground"> · план не задан</span> : ` из ${formatDecimal(plan)}`}
          </span>
        </p>
        {progress !== null && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricGroup
          title="Встречи"
          items={[
            ["Назначено", formatNumber(row.meetingsBooked)],
            ["Состоялось", formatNumber(row.meetingsHeld)],
            ["Не пришли", formatNumber(row.meetingsNoShow)],
            ["Доходимость", percent(row.attendance)],
          ]}
        />
        <MetricGroup
          title="Продажи и оплаты"
          items={[
            ["Продажи", formatNumber(row.sales)],
            ["Оплат", formatNumber(row.paymentsCount)],
            ["Получено", cabinetMoney(row.received, currency)],
            ["Предоплат", formatNumber(row.prepayments)],
          ]}
        />
        <MetricGroup
          title="Задачи и звонки"
          items={[
            ["Выполнено задач", formatNumber(row.tasksDone)],
            ["Звонков", formatNumber(row.calls)],
          ]}
        />
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Хвосты CRM</h3>
          <dl className="space-y-1 text-sm">
            <TailRow label="Просроченные задачи" value={row.overdueTasks} tone="danger" />
            <TailRow label="Встречи без итога" value={row.meetingsWithoutOutcome} tone="danger" />
            <TailRow label="Сделки без шага" value={row.dealsWithoutNextStep} tone="warning" />
            <TailRow label="Переносы без даты" value={row.reschedulesWithoutDate} tone="warning" />
          </dl>
        </div>
      </div>
    </li>
  )
}

function MetricGroup({ title, items }: { title: string; items: readonly (readonly [string, string])[] }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      <dl className="space-y-1 text-sm">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function TailRow({ label, value, tone }: { label: string; value: number; tone: "warning" | "danger" }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <NumLink value={value} tone={tone} />
      </dd>
    </div>
  )
}
