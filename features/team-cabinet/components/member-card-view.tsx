import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Headphones } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { ListPanel } from "@/components/shared/list-panel"
import { PrintButton } from "@/components/shared/print-button"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { leadRoute, routes } from "@/config/routes"
import { RatingStars } from "@/features/calls"
import { AbsenceLabel, CabinetSection, MetricLabel } from "@/features/team-cabinet/components/cabinet-parts"
import { cabinetLinks } from "@/features/team-cabinet/lib/links"
import { teamCabinetRepository } from "@/features/team-cabinet/api/team-cabinet-repository"
import type { MemberCard } from "@/features/team-cabinet/schemas"
import { tryLoad } from "@/lib/api/load"
import { formatDayMonth, formatDecimal, formatDecimalMoney, formatNumber, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

const SCORE_CLASSES: Record<number, string> = {
  5: "bg-success/25 text-success",
  4: "bg-success/12 text-success",
  3: "bg-warning/15 text-warning",
  2: "bg-destructive/15 text-destructive",
}

export async function MemberCardView({ managerId }: { managerId: string }) {
  const result = await tryLoad(() => teamCabinetRepository.getMemberCard(managerId))
  if (!result.ok) return <ApiErrorState error={result.error} />
  if (!result.data) notFound()
  const card = result.data
  const { plan } = card

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href={routes.team} className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2 print:hidden" })}>
          <ArrowLeft data-icon="inline-start" aria-hidden />
          Кабинет РОПа
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold tracking-tight">{card.manager.name}</h1>
            <p className="text-meta text-muted-foreground">
              Карточка для one-to-one · {card.periodLabel}
              {card.absence && (
                <>
                  {" · "}
                  <AbsenceLabel absence={card.absence} />
                </>
              )}
            </p>
          </div>
          <PrintButton />
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-3 lg:grid-cols-6">
        <Fact label={<MetricLabel metric="sale">Продажи</MetricLabel>} value={plan.target ? `${plan.fact} из ${plan.target}` : String(plan.fact)} note={plan.target ? formatPercent(plan.fact / plan.target) : "план не задан"} />
        <Fact label="Осталось" value={plan.remaining !== null ? formatNumber(plan.remaining) : "—"} note={`${plan.workDaysLeft} раб. дн. осталось`} />
        <Fact label="Нужно в день" value={plan.perDayNeeded !== null ? formatDecimal(plan.perDayNeeded) : "—"} note={plan.forecast !== null ? `прогноз ≈ ${formatDecimal(plan.forecast)}` : null} />
        <Fact label={<MetricLabel metric="payments">Оплаты сегодня</MetricLabel>} value={formatDecimalMoney(card.paymentsAmount, card.currency)} />
        <Fact label={<MetricLabel metric="attendance" />} value={plan.attendance !== null ? formatPercent(plan.attendance) : "—"} />
        <Fact label={<MetricLabel metric="meetingToSale" />} value={plan.meetingToSale !== null ? formatPercent(plan.meetingToSale) : "—"} />
      </dl>

      <div className="grid gap-8 lg:grid-cols-2">
        <CabinetSection id="member-scores" title="Оценки по дням" description="Оценка дня — предложение ТЗ, пороги обсуждаются">
          <ol className="flex flex-wrap gap-1.5">
            {card.dayScores.map((day) => (
              <li
                key={day.date}
                title={`${formatDayMonth(day.date)}: ${day.score ?? (day.isWorkDay ? "нет оценки" : "выходной")}`}
                className={cn(
                  "flex size-9 flex-col items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                  day.score ? SCORE_CLASSES[day.score] : "bg-muted/40 text-muted-foreground"
                )}
              >
                {day.score ?? "·"}
                <span className="text-[10px] font-normal opacity-70">{day.date.slice(8)}</span>
              </li>
            ))}
          </ol>
        </CabinetSection>

        <CabinetSection id="member-activity" title="Активность" description="Звонки по дням; пустые рабочие дни — сигнал">
          <ol className="flex h-20 items-end gap-1" aria-label="Звонки по дням">
            {card.activity.map((day) => {
              const max = Math.max(...card.activity.map((item) => item.calls), 1)
              const idle = day.isWorkDay && day.calls === 0
              return (
                <li key={day.date} className="flex flex-1 flex-col items-center gap-1" title={`${formatDayMonth(day.date)}: ${day.calls} звонков, ${day.conversations} разговоров`}>
                  <span
                    className={cn("w-full rounded-sm", idle ? "h-1 bg-destructive" : day.isWorkDay ? "bg-primary/70" : "h-1 bg-muted")}
                    style={day.calls > 0 ? { height: `${(day.calls / max) * 64}px` } : undefined}
                  />
                  <span className="text-[10px] text-muted-foreground tabular-nums">{day.date.slice(8)}</span>
                </li>
              )
            })}
          </ol>
          <p className="text-xs text-muted-foreground">Красная черта — рабочий день без единого звонка.</p>
        </CabinetSection>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <CabinetSection id="member-focus" title="На что сделать упор" description="Собрано по правилам кабинета из цифр ниже, не ИИ">
          {card.focusPoints.length === 0 ? (
            <p className="text-meta text-muted-foreground">Явных проблем по цифрам нет — обсудите сильные звонки и рост.</p>
          ) : (
            <ol className="list-decimal space-y-1.5 pl-5 text-sm marker:text-muted-foreground">
              {card.focusPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ol>
          )}
        </CabinetSection>

        <CabinetSection id="member-discipline" title="Дисциплина CRM">
          <dl className="grid grid-cols-2 gap-3">
            {[
              { label: "Встречи без итога", value: card.discipline.withoutOutcome, href: cabinetLinks.meetingsWithoutOutcome(card.manager.id) },
              { label: "Сделки без шага", value: card.discipline.noNextStep, href: cabinetLinks.noNextStep(card.manager.id) },
              { label: "Просроченные задачи", value: card.discipline.overdueTasks, href: cabinetLinks.tasks(card.manager.id) },
              { label: "Переносы без даты", value: card.discipline.rescheduledNoDate, href: cabinetLinks.meetingsToday(card.manager.id) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-muted/30 px-3 py-2">
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className={cn("text-lg font-semibold tabular-nums", item.value > 0 && "text-warning")}>
                  {item.value > 0 ? (
                    <Link href={item.href} className="hover:underline">
                      {formatNumber(item.value)}
                    </Link>
                  ) : (
                    0
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </CabinetSection>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <CallQualitySection card={card} />
        <CabinetSection id="member-listen" title="Послушать перед one-to-one" description="3 слабых и 2 сильных звонка">
          {card.toListen.length === 0 ? (
            <p className="text-meta text-muted-foreground">Оценённых звонков за период нет.</p>
          ) : (
            <ListPanel>
              <ul className="divide-y">
                {card.toListen.map((call) => (
                  <li key={call.callId} className="relative flex items-start gap-3 px-3 py-2 transition-colors hover:bg-accent/40">
                    <Headphones className={cn("mt-0.5 size-4 shrink-0", call.kind === "weak" ? "text-warning" : "text-success")} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <Link href={cabinetLinks.call(call.callId)} className="text-sm font-medium after:absolute after:inset-0">
                        {call.lead?.name ?? "Без лида"}
                      </Link>
                      <p className="line-clamp-2 text-meta text-muted-foreground">{call.summary}</p>
                    </div>
                    <RatingStars score={call.score} />
                  </li>
                ))}
              </ul>
            </ListPanel>
          )}
        </CabinetSection>
      </div>

      <CabinetSection id="member-deals" title="Сделки для дожима" description="Открытые сделки с наибольшей суммой">
        <ListPanel>
          <ul className="divide-y">
            {card.dealsToPush.map((deal) => (
              <li key={deal.id} className="relative grid gap-1 px-4 py-2.5 transition-colors hover:bg-accent/40 sm:grid-cols-[minmax(0,1fr)_12rem_9rem] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <Link href={leadRoute(deal.id)} className="text-sm font-medium after:absolute after:inset-0">
                    {deal.title}
                  </Link>
                  <p className="text-meta text-muted-foreground">{deal.stageName}</p>
                </div>
                <p className={cn("truncate text-meta", deal.nextStep ? "text-foreground/85" : "text-warning")}>{deal.nextStep ?? "Нет следующего шага"}</p>
                <p className="text-sm font-medium tabular-nums sm:text-right">
                  {deal.amount && deal.currency ? formatDecimalMoney(deal.amount, deal.currency) : "—"}
                </p>
              </li>
            ))}
          </ul>
        </ListPanel>
      </CabinetSection>

      <p className="border-t pt-4 text-xs text-muted-foreground print:hidden">
        Итоги one-to-one (навык на фокус, договорённости, проверка) — этап P2: появятся после согласования хранения заметок с backend.
      </p>
    </div>
  )
}

function Fact({ label, value, note }: { label: React.ReactNode; value: string; note?: string | null }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tracking-tight tabular-nums">{value}</dd>
      {note && <dd className="text-meta text-muted-foreground">{note}</dd>}
    </div>
  )
}

function CallQualitySection({ card }: { card: MemberCard }) {
  const quality = card.callQuality
  return (
    <CabinetSection id="member-calls" title="Качество звонков" description="Видно только руководителям">
      {!quality ? (
        <p className="text-meta text-muted-foreground">Оценённых звонков за период нет.</p>
      ) : (
        <div className="space-y-3">
          <ol className="space-y-1.5">
            {quality.distribution.toReversed().map((row) => {
              const max = Math.max(...quality.distribution.map((item) => item.count), 1)
              return (
                <li key={row.score} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 text-meta">
                  <span className="text-muted-foreground tabular-nums">{row.score}★</span>
                  <span className="h-2 rounded-full bg-muted">
                    <span className={cn("block h-full rounded-full", row.score <= 2 ? "bg-destructive/80" : row.score === 3 ? "bg-warning/80" : "bg-success/80")} style={{ width: `${(row.count / max) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums">{row.count}</span>
                </li>
              )
            })}
          </ol>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted-foreground">
            <span>
              <MetricLabel metric="goal">Цель достигнута</MetricLabel>: <strong className="text-foreground">{quality.goalAchievedShare !== null ? formatPercent(quality.goalAchievedShare) : "—"}</strong>
            </span>
            <span>
              <MetricLabel metric="nextStepShare">Шаг с датой</MetricLabel>: <strong className="text-foreground">{quality.nextStepShare !== null ? formatPercent(quality.nextStepShare) : "—"}</strong>
            </span>
            <span>
              Оценено {formatNumber(quality.rated)} из {formatNumber(quality.total)}
            </span>
          </p>
          {quality.gaps.length > 0 && (
            <ul className="space-y-0.5 text-meta">
              {quality.gaps.map((gap) => (
                <li key={gap.label}>— {gap.label}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </CabinetSection>
  )
}

export function MemberCardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  )
}
