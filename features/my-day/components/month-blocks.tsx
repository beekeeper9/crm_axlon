import Link from "next/link"
import {
  AlarmClock,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChartNoAxesColumn,
  CircleDashed,
  MessageSquare,
  Receipt,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { routes } from "@/config/routes"
import { DailyChart } from "@/features/my-day/components/daily-chart"
import { DailyTabs } from "@/features/my-day/components/daily-tabs"
import type { MyMonth, NowSummary } from "@/features/my-day/schemas"
import { formatDayMonth, formatNumber, formatPercent, formatSignedNumber, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

type Money = (value: string) => string

/** Рамка блока «Моего дня»: иконка, подпись и содержимое */
function Block({
  icon: Icon,
  title,
  aside,
  children,
  className,
}: {
  icon?: LucideIcon
  title: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-xl bg-card p-4 ring-1 ring-border", className)}>
      <header className="mb-2 flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-meta text-muted-foreground">
          {Icon && <Icon className="size-3.5" aria-hidden />}
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  )
}

function GrowthBadge({ text }: { text: string }) {
  return <span className="rounded-md bg-success/12 px-1.5 py-0.5 text-xs font-medium text-success tabular-nums">↑ {text}</span>
}

function waitLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours} раб. ч ${minutes % 60} мин` : `${minutes} мин`
}

type Chip = { key: string; icon: LucideIcon; value: string; label: string; tone: "danger" | "warning" | "neutral"; href: string }

const CHIP_TONES: Record<Chip["tone"], string> = {
  danger: "border-destructive/35 bg-destructive/8 [&_strong]:text-destructive",
  warning: "border-warning/35 bg-warning/8 [&_strong]:text-warning",
  neutral: "border-border bg-card [&_strong]:text-foreground",
}

/** «Сейчас»: что горит прямо сейчас. Плитки с нулём не показываются (правило из инструкций) */
export function NowStrip({ now }: { now: NowSummary }) {
  const candidates: (Chip | false)[] = [
    now.awaitingReply.count > 0 && {
      key: "reply",
      icon: MessageSquare,
      value: formatNumber(now.awaitingReply.count),
      label: `ждёт ответа${now.awaitingReply.longestWaitWorkMinutes !== null ? ` · дольше всех ${waitLabel(now.awaitingReply.longestWaitWorkMinutes)}` : ""}`,
      tone: "danger",
      href: routes.focus,
    },
    {
      key: "meetings",
      icon: CalendarCheck,
      value: `${formatNumber(now.meetingsToday.held)} из ${formatNumber(now.meetingsToday.total)}`,
      label: "встреч сегодня состоялось",
      tone: "neutral",
      href: routes.meetings,
    },
    now.meetingsWithoutOutcome > 0 && {
      key: "outcome",
      icon: CircleDashed,
      value: formatNumber(now.meetingsWithoutOutcome),
      label: `${pluralize(now.meetingsWithoutOutcome, ["встреча", "встречи", "встреч"])} без итога`,
      tone: "warning",
      href: routes.afterMeeting,
    },
    now.reschedulesWithoutDate > 0 && {
      key: "resched",
      icon: CalendarClock,
      value: formatNumber(now.reschedulesWithoutDate),
      label: `${pluralize(now.reschedulesWithoutDate, ["перенос", "переноса", "переносов"])} без даты`,
      tone: "warning",
      href: routes.meetings,
    },
    (now.tasks.overdue > 0 || now.tasks.dueToday > 0) && {
      key: "tasks",
      icon: AlarmClock,
      value: formatNumber(now.tasks.overdue),
      label: `${pluralize(now.tasks.overdue, ["задача просрочена", "задачи просрочено", "задач просрочено"])} · ${formatNumber(now.tasks.dueToday)} на сегодня`,
      tone: now.tasks.overdue > 0 ? "danger" : "neutral",
      href: routes.tasks,
    },
  ]
  const chips = candidates.filter((chip): chip is Chip => chip !== false)

  return (
    <section aria-label="Сейчас" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-meta text-muted-foreground">Сейчас</span>
      {chips.map(({ key, icon: Icon, value, label, tone, href }) => (
        <Link
          key={key}
          href={href}
          className={cn("inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors hover:bg-accent", CHIP_TONES[tone])}
        >
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          <strong className="font-semibold tabular-nums">{value}</strong>
          <span className="text-foreground/85">{label}</span>
        </Link>
      ))}
    </section>
  )
}

export function TurnoverBlock({ data, money }: { data: MyMonth; money: Money }) {
  const { turnover } = data
  const progress = turnover.progress === null ? null : Math.min(turnover.progress, 1)
  return (
    <Block icon={Wallet} title={<>Оборот месяца{turnover.target && ` · ориентир ${money(turnover.target)}`}</>}>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{money(turnover.fact)}</span>
        {turnover.progress !== null && <span className="text-sm text-muted-foreground">{formatPercent(turnover.progress)} плана</span>}
        {turnover.growth && <GrowthBadge text={`${money(turnover.growth.amount)} к ${formatDayMonth(turnover.growth.comparedTo)}`} />}
      </p>
      {progress !== null && (
        <div
          className="relative mt-3 h-2 rounded-full bg-muted"
          role="img"
          aria-label={`Выполнено ${formatPercent(progress)}${turnover.expectedProgress !== null ? `, по графику к сегодня ${formatPercent(turnover.expectedProgress)}` : ""}`}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
          {turnover.expectedProgress !== null && (
            <span className="absolute -top-1 h-4 w-0.5 rounded bg-foreground/80" style={{ left: `${Math.min(turnover.expectedProgress, 1) * 100}%` }} aria-hidden />
          )}
        </div>
      )}
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-meta text-muted-foreground">
        {turnover.note && <dd>{turnover.note}</dd>}
        {turnover.expectedToDate && (
          <div className="flex gap-1">
            <dt>к сегодня по плану</dt>
            <dd className="font-semibold text-foreground tabular-nums">{money(turnover.expectedToDate)}</dd>
          </div>
        )}
        {turnover.forecast && (
          <div className="flex gap-1">
            <dt>при таком темпе к концу месяца ≈</dt>
            <dd className="font-semibold text-foreground tabular-nums">{money(turnover.forecast)}</dd>
          </div>
        )}
      </dl>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-muted-foreground">Предоплаты</dt>
          <dd className="font-semibold tabular-nums">{money(turnover.prepayments)}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-muted-foreground">Доплаты</dt>
          <dd className="font-semibold tabular-nums">{money(turnover.additionalPayments)}</dd>
        </div>
      </dl>
    </Block>
  )
}

/** Только отображение: суммы и строки расчёта приходят от backend по правилам мотивации */
export function EarningsBlock({ data, money }: { data: MyMonth; money: Money }) {
  const earnings = data.earnings
  return (
    <Block icon={Receipt} title="Мой заработок за месяц">
      {!earnings ? (
        <p className="text-meta text-muted-foreground">Расчёт заработка ещё не настроен в компании.</p>
      ) : (
        <>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{money(earnings.total)}</p>
          {earnings.notice && (
            <div className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-meta text-primary">
              <p className="font-medium">{earnings.notice.title}</p>
              {earnings.notice.lines.map((line) => (
                <p key={line} className="text-primary/85">
                  {line}
                </p>
              ))}
            </div>
          )}
          <dl className="mt-3 divide-y text-sm">
            {earnings.lines.map((line) => (
              <div key={line.label} className="flex items-start justify-between gap-4 py-2">
                <dt>
                  {line.label}
                  {line.note && <span className="block text-meta text-muted-foreground">{line.note}</span>}
                </dt>
                <dd className="font-semibold whitespace-nowrap tabular-nums">{money(line.amount)}</dd>
              </div>
            ))}
          </dl>
          {earnings.footnote && <p className="mt-2 text-xs text-muted-foreground">{earnings.footnote}</p>}
        </>
      )}
    </Block>
  )
}

export function KpiBlocks({ data, money }: { data: MyMonth; money: Money }) {
  const { sales, salesPerMeeting, averageDeal, meetingsHeld } = data.kpis
  const belowBonus = salesPerMeeting.ratio !== null && salesPerMeeting.bonusThreshold !== null && salesPerMeeting.ratio < salesPerMeeting.bonusThreshold
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Block icon={Target} title="Продажи">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatNumber(sales.count)}</span>
          {sales.growth !== null && sales.growth > 0 && sales.comparedTo && <GrowthBadge text={`${formatSignedNumber(sales.growth).replace("+", "")} к ${formatDayMonth(sales.comparedTo)}`} />}
        </p>
        <p className="mt-1 text-meta text-muted-foreground">{sales.planNote}</p>
      </Block>
      <Block icon={ChartNoAxesColumn} title="Продажи / встречи месяца">
        <p className={cn("text-2xl font-semibold tracking-tight tabular-nums", belowBonus ? "text-warning" : "text-foreground")}>
          {salesPerMeeting.ratio !== null ? formatPercent(salesPerMeeting.ratio) : "—"}
        </p>
        <p className="mt-1 text-meta text-muted-foreground">
          {formatNumber(salesPerMeeting.sales)} {pluralize(salesPerMeeting.sales, ["продажа", "продажи", "продаж"])} / {formatNumber(salesPerMeeting.held)} состоявшихся встреч
          {salesPerMeeting.bonusThreshold !== null && ` · порог премии ${formatPercent(salesPerMeeting.bonusThreshold)}`}
        </p>
      </Block>
      <Block icon={Wallet} title="Средний чек">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{averageDeal.amount ? money(averageDeal.amount) : "—"}</p>
        {averageDeal.note && <p className="mt-1 text-meta text-muted-foreground">{averageDeal.note}</p>}
      </Block>
      <Block icon={CalendarDays} title="Встречи состоялись">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatNumber(meetingsHeld.count)}</p>
        <p className="mt-1 text-meta text-muted-foreground">
          {meetingsHeld.attendance !== null && `доходимость ${formatPercent(meetingsHeld.attendance)} · `}впереди {formatNumber(meetingsHeld.upcoming)}
        </p>
      </Block>
    </div>
  )
}

/** Показатели месяца: встречи по дате встречи, продажи по оплате — горизонтальные полосы */
export function MonthFunnelBlock({ data }: { data: MyMonth }) {
  const { assigned, passed, held, sales, upcoming } = data.monthFunnel
  const max = Math.max(assigned, 1)
  const rows = [
    { label: "Назначено на меня", value: assigned, note: "на даты месяца" },
    { label: "Уже прошли", value: passed, note: `ещё ${formatNumber(upcoming)} впереди` },
    { label: "Состоялись", value: held, note: passed > 0 ? `доходимость ${formatPercent(held / passed)}` : "—" },
    { label: "Продажи месяца", value: sales, note: held > 0 ? `продажи / встречи ${formatPercent(sales / held)}` : "—" },
  ]
  return (
    <Block title={<span className="text-sm font-semibold text-foreground">Показатели месяца</span>} aside={<span className="text-xs text-muted-foreground">встречи по дате встречи, продажи по оплате</span>}>
      <dl className="mt-3 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[9.5rem_minmax(0,1fr)_10rem]">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="relative h-7 overflow-hidden rounded-md bg-muted/50">
              <span className="absolute inset-y-0 left-0 rounded-md bg-primary/30" style={{ width: `${(row.value / max) * 100}%` }} />
              <span className="relative px-2 text-sm leading-7 font-semibold tabular-nums">{formatNumber(row.value)}</span>
            </dd>
            <dd className="text-meta text-muted-foreground max-sm:col-start-2 sm:text-right">{row.note}</dd>
          </div>
        ))}
      </dl>
    </Block>
  )
}

export function DailyBlock({ data }: { data: MyMonth }) {
  return (
    <Block title={<span className="text-sm font-semibold text-foreground">По дням</span>}>
      <DailyTabs turnover={<DailyChart daily={data.daily} series="turnover" />} sales={<DailyChart daily={data.daily} series="sales" />} />
      <p className="mt-2 text-xs text-muted-foreground">
        Сплошная — накопительно по дням, пунктир — сколько положено к этому дню с учётом рабочих дней, столбики — за день.
      </p>
    </Block>
  )
}

export function SegmentBlocks({ data, money }: { data: MyMonth; money: Money }) {
  if (data.segments.length === 0) return null
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.segments.map((segment, index) => (
        <section key={segment.id} className="rounded-xl bg-card p-4 ring-1 ring-border">
          <header className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span className={cn("size-2 rounded-full", index === 0 ? "bg-primary" : "bg-chart-2")} aria-hidden />
              {segment.name}
            </h2>
            <span className="text-meta text-muted-foreground">{formatPercent(segment.share)} оборота</span>
          </header>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">{formatNumber(segment.sales)}</span>
            <span className="text-meta text-muted-foreground">
              {pluralize(segment.sales, ["продажа", "продажи", "продаж"])}
              {segment.previousSales !== null && ` · было ${formatNumber(segment.previousSales)}`}
            </span>
          </p>
          <dl className="mt-2 divide-y text-sm">
            {[
              ["Оборот", money(segment.turnover)],
              ["предоплаты", money(segment.prepayments)],
              ["доплаты", money(segment.additionalPayments)],
              ["Средний чек", segment.averageDeal ? money(segment.averageDeal) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 py-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
