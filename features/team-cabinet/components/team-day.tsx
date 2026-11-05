import Link from "next/link"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { MetricHint } from "@/components/shared/metric-hint"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { routes, teamMemberRoute } from "@/config/routes"
import { fetchTeamBoard, fetchTeamPlanFact, type DayScore, type TeamBoard, type TeamPlanFact } from "@/features/team-cabinet/api/team-board"
import { CabinetSection, LevelDot } from "@/features/team-cabinet/components/cabinet-parts"
import { cabinetMoney } from "@/features/team-cabinet/lib/money"
import { tryLoad } from "@/lib/api/load"
import { nowIso } from "@/lib/clock"
import { companyDateOf } from "@/lib/datetime"
import { formatDayMonth, formatDecimal, formatNumber, formatTime } from "@/lib/format"
import { getParam, hrefWithParams, type SearchParamsRecord } from "@/lib/search-params"
import { cn } from "@/lib/utils"

/** Правила светофора backend простыми словами */
const REASONS: Record<string, string> = {
  no_activity: "Нет активности за рабочий день",
  meeting_without_outcome: "Встреча прошла, итог не записан",
  morning_confirmations_below_threshold: "Мало подтверждённых утренних встреч",
  overdue_tasks: "Есть просроченные задачи",
  reschedules_without_date: "Переносы без новой даты",
}

const SCORE_DEFINITION =
  "Оценка по пятибалльной шкале из 100 баллов: до 50 — результат (продажи месяца против плана, пропорционально прошедшим дням), до 50 — дисциплина CRM (итоги прошедших встреч, подтверждения, переносы с датой, нет просроченных задач). Без личного плана считается только дисциплина (×2). 5 — от 90 баллов, 4 — 75–89, 3 — 60–74, 2 — ниже 60. Без активности за день и в плановом отсутствии оценки нет."

const GRADE_TONES: Record<number, string> = {
  5: "bg-success/15 text-success",
  4: "bg-success/10 text-success",
  3: "bg-warning/15 text-warning",
  2: "bg-destructive/15 text-destructive",
}

/** Вчерашняя дата компании (ГГГГ-ММ-ДД) */
function yesterdayOf(today: string): string {
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

/**
 * «День отдела»: карточка на каждого менеджера. Пока сегодня ни у кого нет оценки (день только
 * начался), по умолчанию показан вчерашний день; переключатель «Сегодня / Вчера» — в адресе (`?day=`).
 */
export async function TeamDaySection({ params }: { params: SearchParamsRecord }) {
  const dayParam = getParam(params, "day")
  const requested = dayParam === "today" || dayParam === "yesterday" ? dayParam : null
  const yesterday = yesterdayOf(companyDateOf(nowIso()))
  const result = await tryLoad(async () => {
    if (requested === "yesterday") return { board: await fetchTeamBoard(yesterday), auto: false }
    const today = await fetchTeamBoard()
    const started = today.managers.some((row) => row.score !== null)
    if (requested === "today" || started || today.managers.length === 0) return { board: today, auto: false }
    return { board: await fetchTeamBoard(yesterday), auto: true }
  })
  if (!result.ok) return <ApiErrorState error={result.error} />
  const { board, auto } = result.data
  const isYesterday = board.date === yesterday
  const href = (day: "today" | "yesterday") => hrefWithParams(routes.team, params, { day })

  return (
    <CabinetSection
      id="team-today"
      title={isYesterday ? `День отдела · вчера, ${formatDayMonth(yesterday)}` : "День отдела · сегодня"}
      description={
        auto
          ? "Сегодня оценок ещё нет — день только начался, поэтому показаны итоги вчерашнего дня."
          : `Данные на ${formatTime(board.asOf)} · нужно вмешаться: ${formatNumber(board.totals.red)}, есть хвосты: ${formatNumber(board.totals.yellow)}, в порядке: ${formatNumber(board.totals.green)}`
      }
      action={
        <SegmentedLinks
          label="День"
          variant="pill"
          items={[
            { key: "today", label: "Сегодня", href: href("today"), isActive: !isYesterday },
            { key: "yesterday", label: "Вчера", href: href("yesterday"), isActive: isYesterday },
          ]}
        />
      }
    >
      {board.managers.length === 0 ? (
        <p className="text-sm text-muted-foreground">В отделе пока нет менеджеров.</p>
      ) : (
        <ol className="space-y-3">
          {board.managers.map((row) => (
            <li key={row.userId}>
              <ManagerDayCard row={row} currency={board.currency} isToday={!isYesterday} />
            </li>
          ))}
        </ol>
      )}
    </CabinetSection>
  )
}

type ManagerRow = TeamBoard["managers"][number]

function ManagerDayCard({ row, currency, isToday }: { row: ManagerRow; currency: string | null; isToday: boolean }) {
  const reasons = [...row.redReasons, ...row.yellowReasons].map((code) => REASONS[code] ?? code)
  const plan = row.planSales === null ? null : Number(row.planSales)
  const planPercent = plan && plan > 0 ? Math.round((row.salesMonth / plan) * 100) : null
  const tasks = (due: "today" | "overdue" | null) => hrefWithParams(routes.tasks, {}, { assignee: row.userId, due })
  const meetings = hrefWithParams(routes.meetings, {}, { host: row.userId })

  return (
    <article aria-label={row.name} className="space-y-3 rounded-xl px-4 py-3 ring-1 ring-border">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="flex items-center gap-2">
            <LevelDot level={row.status} />
            <Link href={teamMemberRoute(row.userId)} className="font-medium hover:text-primary hover:underline">
              {row.name}
            </Link>
          </p>
          {row.onAbsence && <p className="text-xs text-muted-foreground">Отсутствует по графику</p>}
          {reasons.length > 0 && <p className="text-xs text-muted-foreground">{reasons.join(" · ")}</p>}
        </div>
        <ScoreBlock score={row.score} />
      </header>

      <div className="space-y-1">
        <p className="flex justify-between gap-2 text-meta text-muted-foreground">
          <span>План продаж на месяц</span>
          <span className="tabular-nums">
            {plan === null ? "не задан" : `${formatNumber(row.salesMonth)} из ${formatDecimal(plan)}${planPercent === null ? "" : ` · ${formatNumber(planPercent)}%`}`}
          </span>
        </p>
        <Bar percent={planPercent ?? 0} label={`${row.name}: выполнение плана продаж`} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-8">
        <Figure label="Встреч назначено" value={row.meetingsTotal} href={meetings} />
        <Figure label="Подтверждено" value={row.meetingsConfirmed} />
        <Figure label="Осталось подтвердить" value={row.meetingsToConfirm} tone="warning" href={meetings} />
        <Figure label="Состоялись" value={row.meetingsHeld} />
        <Figure label="Звонки" value={row.calls} />
        <Figure label="Оплаты" value={row.paymentsCount} note={row.paymentsCount > 0 ? cabinetMoney(row.received, currency) : null} />
        <Figure label="Предоплаты" value={row.prepayments} />
        <div className="space-y-0.5">
          <dt className="text-xs text-muted-foreground">{isToday ? "Задачи сегодня" : "Задачи"}</dt>
          <dd className="text-sm tabular-nums">
            <Link href={tasks("today")} className="font-medium hover:text-primary" title="Со сроком на день">
              {formatNumber(row.tasksDueToday)}
            </Link>
            <span className="text-xs text-muted-foreground">
              {" "}
              · открыто{" "}
              <Link href={tasks(null)} className="hover:text-primary">
                {formatNumber(row.openTasks)}
              </Link>{" "}
              · просрочено{" "}
              <Link href={tasks("overdue")} className={cn("hover:text-primary", row.overdueTasks > 0 && "font-medium text-destructive")}>
                {formatNumber(row.overdueTasks)}
              </Link>
            </span>
          </dd>
        </div>
      </dl>
    </article>
  )
}

function ScoreBlock({ score }: { score: DayScore | null }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="inline-flex items-center gap-1 text-meta text-muted-foreground">
        Оценка дня
        <MetricHint label="Оценка дня" definition={SCORE_DEFINITION} />
      </span>
      {score ? (
        <span className={cn("inline-flex items-baseline gap-1 rounded-md px-2 py-0.5 font-semibold tabular-nums", GRADE_TONES[score.grade])} title={`Результат ${score.result ?? "— (нет плана)"}, дисциплина ${score.discipline}`}>
          {score.grade}
          <span className="text-xs font-normal opacity-80">из 5 · {score.points} баллов</span>
        </span>
      ) : (
        <span className="text-muted-foreground">нет оценки</span>
      )}
    </div>
  )
}

function Figure({ label, value, href, tone, note }: { label: string; value: number; href?: string; tone?: "warning"; note?: string | null }) {
  const text = formatNumber(value)
  const className = cn("text-sm font-medium tabular-nums", value === 0 ? "text-muted-foreground" : tone === "warning" && "text-warning")
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>
        {href && value > 0 ? (
          <Link href={href} className={cn(className, "hover:text-primary")}>
            {text}
          </Link>
        ) : (
          <span className={className}>{text}</span>
        )}
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </dd>
    </div>
  )
}

function Bar({ percent, label }: { percent: number; label: string }) {
  const width = Math.min(Math.max(percent, 0), 100)
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={width}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
    </div>
  )
}

/** «План — факт»: карточка на менеджера — план, сделано, осталось, прогноз, получено */
export async function PlanFactSection() {
  const result = await tryLoad(fetchTeamPlanFact)
  return result.ok ? <PlanFactCards planFact={result.data} /> : <ApiErrorState error={result.error} />
}

function PlanFactCards({ planFact }: { planFact: TeamPlanFact }) {
  return (
    <CabinetSection
      id="team-plan-fact"
      title={`План — факт · ${planFact.month}`}
      description={`Прошло дней: ${formatNumber(planFact.workingDaysElapsed)} из ${formatNumber(planFact.workingDaysTotal)}. Прогноз — линейный по темпу, это оценка, а не факт.`}
    >
      {planFact.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">В отделе пока нет менеджеров.</p>
      ) : (
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {planFact.rows.map((row) => (
            <li key={row.userId}>
              <PlanFactCard
                name={row.name}
                href={teamMemberRoute(row.userId)}
                plan={Number(row.planSales)}
                actual={row.salesActual}
                remaining={Number(row.remainingSales)}
                forecast={Number(row.forecastSales)}
                received={cabinetMoney(row.receivedActual, planFact.currency)}
              />
            </li>
          ))}
          <li>
            <PlanFactCard
              name="Весь отдел"
              plan={Number(planFact.planSalesTotal)}
              actual={planFact.salesActualTotal}
              remaining={Math.max(Number(planFact.planSalesTotal) - planFact.salesActualTotal, 0)}
              forecast={Number(planFact.forecastSalesTotal)}
              received={cabinetMoney(planFact.receivedTotal, planFact.currency)}
              isTotal
            />
          </li>
        </ol>
      )}
    </CabinetSection>
  )
}

function PlanFactCard({
  name,
  href,
  plan,
  actual,
  remaining,
  forecast,
  received,
  isTotal = false,
}: {
  name: string
  href?: string
  plan: number
  actual: number
  remaining: number
  forecast: number
  received: React.ReactNode
  isTotal?: boolean
}) {
  const hasPlan = plan > 0
  const percent = hasPlan ? Math.round((actual / plan) * 100) : null
  return (
    <article aria-label={name} className={cn("h-full space-y-2.5 rounded-xl px-4 py-3 ring-1 ring-border", isTotal && "bg-muted/30")}>
      <p className="flex items-baseline justify-between gap-2">
        {href ? (
          <Link href={href} className="font-medium hover:text-primary hover:underline">
            {name}
          </Link>
        ) : (
          <span className="font-medium">{name}</span>
        )}
        {percent !== null && <span className="text-sm font-medium tabular-nums">{formatNumber(percent)}%</span>}
      </p>
      <Bar percent={percent ?? 0} label={`${name}: выполнение плана продаж`} />
      <dl className="space-y-1 text-sm">
        <Row label="План продаж">{hasPlan ? formatDecimal(plan) : <span className="text-muted-foreground">не задан</span>}</Row>
        <Row label="Сделано продаж">{formatNumber(actual)}</Row>
        <Row label="Осталось">{hasPlan ? formatDecimal(remaining) : "—"}</Row>
        <Row label="Прогноз на месяц">{formatDecimal(forecast)}</Row>
        <Row label="Получено оплат">{received}</Row>
      </dl>
    </article>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  )
}
