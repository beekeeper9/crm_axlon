import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { ListPanel } from "@/components/shared/list-panel"
import { PrintButton } from "@/components/shared/print-button"
import { buttonVariants } from "@/components/ui/button"
import { routes } from "@/config/routes"
import { fetchMemberCard, type MemberCard, type PeriodFigures } from "@/features/team-cabinet/api/team-board"
import { CabinetSection, NumLink } from "@/features/team-cabinet/components/cabinet-parts"
import { tryLoad } from "@/lib/api/load"
import { formatDayMonth, formatDecimal, formatNumber, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

type Row = { key: keyof PeriodFigures; label: string; money?: boolean }

/** Показатели периода: одинаковые определения в карточке, отчётах и дне отдела */
const ROWS: readonly Row[] = [
  { key: "meetingsBooked", label: "Встреч назначено" },
  { key: "meetingsHeld", label: "Состоялось" },
  { key: "meetingsNoShow", label: "Не пришли" },
  { key: "meetingsConfirmed", label: "Подтверждено" },
  { key: "sales", label: "Продажи (сделки с первой оплатой)" },
  { key: "paymentsCount", label: "Оплаты, шт." },
  { key: "received", label: "Оплаты, сумма", money: true },
  { key: "prepayments", label: "Предоплаты, шт." },
  { key: "calls", label: "Звонки" },
  { key: "stageChanges", label: "Смены этапов" },
  { key: "tasksDone", label: "Задачи выполнены" },
]

const AVERAGE_KEYS: Partial<Record<keyof PeriodFigures, string>> = {
  meetingsBooked: "meetingsBooked",
  meetingsHeld: "meetingsHeld",
  meetingsNoShow: "meetingsNoShow",
  sales: "sales",
  paymentsCount: "paymentsCount",
  received: "received",
  calls: "calls",
  stageChanges: "stageChanges",
  tasksDone: "tasksDone",
}

function value(figures: PeriodFigures, row: Row): number {
  return Number(figures[row.key] ?? 0)
}

function show(n: number, money = false): string {
  return money ? formatDecimal(n) : formatNumber(n)
}

function ratio(raw: string | null): string {
  return raw === null ? "—" : formatPercent(Number(raw))
}

/**
 * Карточка менеджера для one-to-one (режим api): период (по умолчанию 14 дней), сравнение
 * с прошлым периодом той же длины и со средним по отделу, активность по дням, хвосты CRM.
 */
export async function ServerMemberCardView({ managerId, dateFrom, dateTo }: { managerId: string; dateFrom: string | null; dateTo: string | null }) {
  const result = await tryLoad(() => fetchMemberCard(managerId, dateFrom, dateTo))
  if (!result.ok) return <ApiErrorState error={result.error} />
  if (!result.data) notFound()
  const card: MemberCard = result.data
  const average = card.departmentAverage

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href={routes.team} className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2 print:hidden" })}>
          <ArrowLeft data-icon="inline-start" aria-hidden />
          Мой кабинет
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold tracking-tight">{card.name}</h1>
            <p className="text-meta text-muted-foreground">
              Карточка для one-to-one · {formatDayMonth(card.dateFrom)} — {formatDayMonth(card.dateTo)}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2 print:hidden">
            <form className="flex flex-wrap items-end gap-2" action="">
              <label className="grid gap-1 text-meta text-muted-foreground">
                С
                <input type="date" name="date_from" defaultValue={card.dateFrom} className="h-8 rounded-md border bg-background px-2 text-sm text-foreground" />
              </label>
              <label className="grid gap-1 text-meta text-muted-foreground">
                По
                <input type="date" name="date_to" defaultValue={card.dateTo} className="h-8 rounded-md border bg-background px-2 text-sm text-foreground" />
              </label>
              <button type="submit" className="h-8 rounded-md px-3 text-sm ring-1 ring-border hover:bg-muted">
                Показать
              </button>
            </form>
            <PrintButton />
          </div>
        </div>
      </header>

      <CabinetSection id="card-plan" title={`План — факт · ${card.month}`}>
        <p className="text-sm">
          <span className="text-2xl font-semibold tabular-nums">{formatNumber(card.monthSales)}</span>
          <span className="text-muted-foreground">
            {card.planSales === null ? " продаж · личный план не задан" : ` из ${formatDecimal(Number(card.planSales))} продаж`}
          </span>
        </p>
        <p className="text-meta text-muted-foreground">
          Доходимость (состоялись / с итогом): {ratio(card.current.attendance)} · CR встреча → продажа: {ratio(card.current.meetingToSale)}
          {" "}(прошлый период: {ratio(card.previous.attendance)} · {ratio(card.previous.meetingToSale)})
        </p>
      </CabinetSection>

      <CabinetSection id="card-figures" title="Показатели периода" description="Сравнение с прошлым периодом той же длины и со средним по отделу на одного сотрудника.">
        <ListPanel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Показатель</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Период</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Прошлый</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Среднее по отделу</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ROWS.map((row) => {
                  const now = value(card.current, row)
                  const before = value(card.previous, row)
                  const avgKey = AVERAGE_KEYS[row.key]
                  const avg = avgKey && average[avgKey] !== undefined ? Number(average[avgKey]) : null
                  return (
                    <tr key={row.key}>
                      <td className="px-3 py-2">{row.label}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{show(now, row.money)}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", now < before ? "text-destructive" : "text-muted-foreground")}>
                        {show(before, row.money)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{avg === null ? "—" : row.money ? formatDecimal(avg) : formatDecimal(avg)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ListPanel>
      </CabinetSection>

      <CabinetSection
        id="card-activity"
        title="Активность по дням"
        description={
          card.daysWithoutActivity.length > 0
            ? `Дней без активности: ${formatNumber(card.daysWithoutActivity.length)} (рабочие дни, кроме отсутствий по графику)`
            : "Дней без активности нет"
        }
      >
        <ListPanel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">День</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Звонки</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Встречи</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Смены этапов</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Оплаты</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {card.activity.map((day) => {
                  const silent = card.daysWithoutActivity.includes(day.date)
                  return (
                    <tr key={day.date} className={cn(silent && "bg-destructive/5")}>
                      <td className="px-3 py-2">
                        {formatDayMonth(day.date)}
                        {day.absent && <span className="ml-2 text-xs text-muted-foreground">отсутствие</span>}
                        {silent && <span className="ml-2 text-xs text-destructive">нет активности</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(day.calls)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(day.meetings)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(day.stageChanges)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(day.payments)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ListPanel>
      </CabinetSection>

      <CabinetSection id="card-discipline" title="Дисциплина CRM сейчас">
        <dl className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Встречи без итога", value: card.discipline.meetingsWithoutOutcome, href: `${routes.meetings}?host=${card.userId}&outcome=required` },
            { label: "Переносы без даты", value: card.discipline.reschedulesWithoutDate, href: `${routes.meetings}?host=${card.userId}&status=rescheduled` },
            { label: "Сделки без следующего шага", value: card.discipline.dealsWithoutNextStep, href: undefined },
            { label: "Просроченные задачи", value: card.discipline.overdueTasks, href: `${routes.tasks}?assignee=${card.userId}&due=overdue` },
          ].map((item) => (
            <div key={item.label} className="rounded-xl px-4 py-3 ring-1 ring-border">
              <dt className="text-meta text-muted-foreground">{item.label}</dt>
              <dd className="text-xl font-semibold">
                <NumLink value={item.value} tone="danger" href={item.href} />
              </dd>
            </div>
          ))}
        </dl>
      </CabinetSection>
    </div>
  )
}
