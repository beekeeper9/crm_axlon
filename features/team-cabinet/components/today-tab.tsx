import Link from "next/link"
import { ArrowRight, CheckCheck, CircleAlert } from "lucide-react"

import { ListPanel } from "@/components/shared/list-panel"
import { routes } from "@/config/routes"
import { AbsenceLabel, CabinetSection, LevelDot, MetricLabel, NumLink } from "@/features/team-cabinet/components/cabinet-parts"
import { attentionHref, cabinetLinks } from "@/features/team-cabinet/lib/links"
import type { TeamRow, TeamToday, TodayMetrics } from "@/features/team-cabinet/schemas"
import { formatDecimal, formatDecimalMoney, formatNumber, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Сколько пунктов «требует внимания» показываем сразу (ТЗ: 3–5 строк) */
const ATTENTION_VISIBLE = 5

export function TodayTab({ data }: { data: TeamToday }) {
  return (
    <div className="space-y-8">
      <TeamLights rows={data.rows} />
      <DepartmentPulse data={data} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <AttentionList data={data} />
        <QuickLinks metrics={data.department.today} />
      </div>
      <TeamTable data={data} />
    </div>
  )
}

/** Светофор по менеджерам для телефона (ТЗ, п. 6): на широком экране его показывает таблица */
function TeamLights({ rows }: { rows: readonly TeamRow[] }) {
  return (
    <ul aria-label="Статус менеджеров" className="-mb-4 flex flex-wrap gap-x-4 gap-y-2 lg:hidden">
      {rows.map((row) => (
        <li key={row.manager.id}>
          <Link href={cabinetLinks.member(row.manager.id)} className="flex items-center gap-1.5 text-sm">
            <LevelDot level={row.level} />
            {row.manager.name.split(" ")[0]}
            {row.absence && <span className="text-xs text-muted-foreground">· {row.absence.label.toLowerCase()}</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Состояние отдела одной строкой: план, встречи сегодня, ответы клиентам, хвосты CRM */
function DepartmentPulse({ data }: { data: TeamToday }) {
  const { plan, today } = data.department
  const hygiene = today.hygiene.withoutOutcome + today.hygiene.noNextStep + today.hygiene.rescheduledNoDate
  const items: { label: React.ReactNode; value: string; note: string; href?: string; tone?: string }[] = [
    {
      label: <MetricLabel metric="sale">Продажи отдела</MetricLabel>,
      value: plan.target ? `${formatNumber(plan.fact)} из ${formatNumber(plan.target)}` : formatNumber(plan.fact),
      note:
        plan.remaining !== null
          ? `осталось ${formatNumber(plan.remaining)} · нужно ${plan.perDayNeeded !== null ? formatDecimal(plan.perDayNeeded) : "—"} в день`
          : "план не задан",
    },
    {
      label: <MetricLabel metric="confirmed">Встречи сегодня</MetricLabel>,
      value: `${formatNumber(today.meetings.confirmed)} из ${formatNumber(today.meetings.total)} подтв.`,
      note:
        today.meetings.toConfirm > 0
          ? `осталось подтвердить ${formatNumber(today.meetings.toConfirm)}${today.meetings.nextToConfirmAt ? ` · ближ. ${formatTime(today.meetings.nextToConfirmAt)}` : ""}`
          : "все подтверждены",
      href: cabinetLinks.meetingsToday(),
      tone: today.meetings.toConfirm > 0 ? "text-warning" : undefined,
    },
    {
      label: "Ждут ответа",
      value: formatNumber(today.waitingReplies.count),
      note: today.waitingReplies.maxWaitHours !== null ? `дольше всех ${formatDecimal(today.waitingReplies.maxWaitHours)} ч` : "никто не ждёт",
      href: routes.focus,
      tone: today.waitingReplies.count > 0 ? "text-warning" : undefined,
    },
    {
      label: "Хвосты CRM",
      value: formatNumber(hygiene),
      note: `без итога ${today.hygiene.withoutOutcome} · без шага ${today.hygiene.noNextStep}`,
      href: cabinetLinks.noNextStep(),
      tone: hygiene > 0 ? "text-warning" : undefined,
    },
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 lg:grid-cols-4 lg:divide-x lg:[&>div:not(:first-child)]:pl-6">
      {items.map((item, index) => (
        <div key={index} className="min-w-0 space-y-0.5">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={cn("text-xl font-semibold tracking-tight tabular-nums", item.tone)}>
            {item.href ? (
              <Link href={item.href} className="hover:underline">
                {item.value}
              </Link>
            ) : (
              item.value
            )}
          </dd>
          <dd className="text-meta text-muted-foreground">{item.note}</dd>
        </div>
      ))}
    </dl>
  )
}

function AttentionList({ data }: { data: TeamToday }) {
  const items = data.attention.slice(0, ATTENTION_VISIBLE)
  const hidden = data.attention.length - items.length
  return (
    <CabinetSection
      id="cabinet-attention"
      title="Что требует внимания сегодня"
      description="Собирается само по правилам кабинета: кому и на чём давить в первую очередь"
    >
      {items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-success/8 px-4 py-4 text-sm ring-1 ring-success/20">
          <CheckCheck className="size-4 text-success" aria-hidden />
          Отклонений нет — отдел идёт по графику, хвостов CRM нет.
        </p>
      ) : (
        <ListPanel>
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="relative flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40 focus-within:bg-accent/40">
                <CircleAlert
                  className={cn("size-4 shrink-0", item.priority === "high" ? "text-destructive" : "text-warning")}
                  aria-label={item.priority === "high" ? "Высокий приоритет" : "Средний приоритет"}
                />
                <p className="min-w-0 flex-1 text-sm">
                  <Link href={attentionHref(item)} className="font-medium after:absolute after:inset-0 focus-visible:outline-none">
                    {item.manager?.name.split(" ")[0] ?? "Отдел"}
                  </Link>
                  <span className="text-foreground/85"> — {item.problem}</span>
                  {item.value && <span className="font-semibold tabular-nums">: {item.value}</span>}
                </p>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </li>
            ))}
          </ul>
          {hidden > 0 && <p className="border-t px-4 py-2 text-meta text-muted-foreground">И ещё {formatNumber(hidden)} — в таблице «Команда сегодня»</p>}
        </ListPanel>
      )}
    </CabinetSection>
  )
}

/** Быстрые переходы руководителя — только существующие экраны с фильтром */
function QuickLinks({ metrics }: { metrics: TodayMetrics }) {
  const links = [
    { label: "Просроченные задачи", count: metrics.tasks.overdue, href: cabinetLinks.tasks() },
    { label: "Встречи без итога", count: metrics.hygiene.withoutOutcome, href: cabinetLinks.meetingsWithoutOutcome() },
    { label: "Сделки без следующего шага", count: metrics.hygiene.noNextStep, href: cabinetLinks.noNextStep() },
    { label: "После встречи", count: null, href: cabinetLinks.afterMeeting() },
    { label: "Звонки команды", count: null, href: cabinetLinks.calls() },
    { label: "Отчёты дня", count: null, href: routes.dailyReports },
  ]
  return (
    <nav aria-labelledby="cabinet-links" className="space-y-2.5">
      <h2 id="cabinet-links" className="text-base font-semibold">Перейти</h2>
      <ul className="space-y-0.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent">
              {link.label}
              {link.count !== null && (
                <span className={cn("tabular-nums", link.count > 0 ? "font-medium text-warning" : "text-muted-foreground")}>{formatNumber(link.count)}</span>
              )}
            </Link>
          </li>
        ))}
        <li className="px-2 py-1.5 text-meta text-muted-foreground" title="Нужен API планов">
          Планы сотрудников — после согласования API
        </li>
      </ul>
    </nav>
  )
}

const TH = "h-9 px-2 text-right font-medium whitespace-nowrap first:pl-4 first:text-left last:pr-4"
const TD = "px-2 py-2 text-right tabular-nums whitespace-nowrap first:pl-4 first:text-left last:pr-4"

function TeamTable({ data }: { data: TeamToday }) {
  return (
    <CabinetSection
      id="cabinet-team"
      title="Команда сегодня"
      description="Клик по числу открывает экран с этим фильтром. Строка «Отдел» — итог backend."
    >
      <ListPanel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
              <tr>
                <th scope="col" className={cn(TH, "sticky left-0 z-10 bg-card")}>
                  <MetricLabel metric="dayStatus">Сотрудник</MetricLabel>
                </th>
                <th scope="col" className={TH}><MetricLabel metric="dayScore">Оценка</MetricLabel></th>
                <th scope="col" className={TH}><MetricLabel metric="confirmed">Встречи подтв.</MetricLabel></th>
                <th scope="col" className={TH}>Осталось подтвердить</th>
                <th scope="col" className={TH}><MetricLabel metric="held">Состоялось</MetricLabel></th>
                <th scope="col" className={TH}>Без итога</th>
                <th scope="col" className={TH}><MetricLabel metric="payments">Оплат сегодня</MetricLabel></th>
                <th scope="col" className={TH}><MetricLabel metric="conversation">Разговоров</MetricLabel></th>
                <th scope="col" className={TH}>Просрочено задач</th>
                <th scope="col" className={TH}>Без шага</th>
                <th scope="col" className={TH}><MetricLabel metric="sale">До плана</MetricLabel></th>
                <th scope="col" className={TH}><MetricLabel metric="workDay">В день</MetricLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.rows.map((row) => (
                <TeamRowView key={row.manager.id} row={row} />
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border bg-muted/30 font-medium">
              <MetricsCells label="Отдел" metrics={data.department.today} remaining={data.department.plan.remaining} perDay={data.department.plan.perDayNeeded} />
            </tfoot>
          </table>
        </div>
      </ListPanel>
    </CabinetSection>
  )
}

function TeamRowView({ row }: { row: TeamRow }) {
  const { manager, today } = row
  const id = manager.id
  if (row.absence) {
    return (
      <tr className="text-muted-foreground">
        <td className={cn(TD, "sticky left-0 z-10 bg-card")}>
          <NameCell row={row} />
        </td>
        <td colSpan={9} className={cn(TD, "text-left")}>
          <AbsenceLabel absence={row.absence} /> · запланированное отсутствие, в план-факте рабочие дни учтены
        </td>
        <td className={TD}>{row.plan.remaining !== null ? formatNumber(row.plan.remaining) : "не задан"}</td>
        <td className={TD}>—</td>
      </tr>
    )
  }
  if (row.inactiveDays > 0) {
    return (
      <tr className="bg-destructive/5">
        <td className={cn(TD, "sticky left-0 z-10 bg-card")}>
          <NameCell row={row} />
        </td>
        <td colSpan={9} className={cn(TD, "text-left font-medium text-destructive")}>
          Нет активности: ни звонков, ни сообщений, ни встреч · {row.inactiveDays} дн. подряд
        </td>
        <td className={TD}>{row.plan.remaining !== null ? formatNumber(row.plan.remaining) : <span className="text-muted-foreground">не задан</span>}</td>
        <td className={TD}>—</td>
      </tr>
    )
  }
  return (
    <tr className="transition-colors hover:bg-accent/30">
      <td className={cn(TD, "sticky left-0 z-10 bg-card")}>
        <NameCell row={row} />
      </td>
      <td className={TD}>
        {row.dayScore === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className={cn("font-semibold", row.dayScore <= 2 ? "text-destructive" : row.dayScore === 3 ? "text-warning" : "text-success")}>{row.dayScore}</span>
        )}
      </td>
      <RowCells id={id} metrics={today} remaining={row.plan.remaining} perDay={row.plan.perDayNeeded} />
    </tr>
  )
}

function NameCell({ row }: { row: TeamRow }) {
  return (
    <div className="flex min-w-44 items-start gap-2">
      <LevelDot level={row.level} className="mt-1.5" />
      <div className="min-w-0">
        <Link href={cabinetLinks.member(row.manager.id)} className="font-medium hover:underline">
          {row.manager.name}
        </Link>
        {row.level !== "green" && <p className="max-w-56 truncate text-xs text-muted-foreground">{row.reasons[0]}</p>}
      </div>
    </div>
  )
}

function RowCells({ id, metrics, remaining, perDay }: { id?: string; metrics: TodayMetrics; remaining: number | null; perDay: number | null }) {
  const { meetings } = metrics
  return (
    <>
      <td className={TD}>
        <Link href={cabinetLinks.meetingsToday(id)} className="hover:underline">
          {formatNumber(meetings.confirmed)} / {formatNumber(meetings.total)}
        </Link>
      </td>
      <td className={TD}>
        <NumLink value={meetings.toConfirm} href={cabinetLinks.meetingsToday(id)} tone="warning" />
        {meetings.toConfirm > 0 && meetings.nextToConfirmAt && (
          <span className="ml-1 text-xs text-muted-foreground">ближ. {formatTime(meetings.nextToConfirmAt)}</span>
        )}
      </td>
      <td className={TD}>
        <NumLink value={meetings.held} href={cabinetLinks.meetingsToday(id)} />
      </td>
      <td className={TD}>
        <NumLink value={metrics.hygiene.withoutOutcome} href={cabinetLinks.meetingsWithoutOutcome(id)} tone="danger" />
      </td>
      <td className={TD}>
        {metrics.payments.count > 0 ? (
          <span>
            {formatNumber(metrics.payments.count)} · <span className="text-muted-foreground">{formatDecimalMoney(metrics.payments.amount, metrics.payments.currency)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/70">0</span>
        )}
      </td>
      <td className={TD}>
        <NumLink value={metrics.calls.conversations} href={cabinetLinks.calls(id)} />
        <span className="ml-1 text-xs text-muted-foreground">из {formatNumber(metrics.calls.total)}</span>
      </td>
      <td className={TD}>
        <NumLink value={metrics.tasks.overdue} href={cabinetLinks.tasks(id)} tone="warning" />
      </td>
      <td className={TD}>
        <NumLink value={metrics.hygiene.noNextStep} href={cabinetLinks.noNextStep(id)} tone="warning" />
      </td>
      <td className={TD}>{remaining !== null ? formatNumber(remaining) : <span className="text-muted-foreground">не задан</span>}</td>
      <td className={TD}>{perDay !== null ? formatDecimal(perDay) : <span className="text-muted-foreground">—</span>}</td>
    </>
  )
}

function MetricsCells({ label, ...props }: { label: string; metrics: TodayMetrics; remaining: number | null; perDay: number | null }) {
  return (
    <tr>
      <td className={cn(TD, "sticky left-0 z-10 bg-card")}>{label}</td>
      <td className={TD} />
      <RowCells {...props} />
    </tr>
  )
}
