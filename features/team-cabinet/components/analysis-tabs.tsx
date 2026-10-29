import Link from "next/link"
import { Headphones } from "lucide-react"

import { ListPanel } from "@/components/shared/list-panel"
import { leadRoute, routes } from "@/config/routes"
import { RatingStars } from "@/features/calls"
import { AbsenceLabel, CabinetSection, MetricLabel } from "@/features/team-cabinet/components/cabinet-parts"
import { cabinetLinks } from "@/features/team-cabinet/lib/links"
import type { Plan, TeamFunnel, TeamQuality, TeamRow, TeamToday } from "@/features/team-cabinet/schemas"
import { formatDateTime, formatDecimal, formatDecimalMoney, formatNumber, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

const TH = "h-9 px-3 text-right font-medium whitespace-nowrap first:pl-4 first:text-left last:pr-4"
const TD = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap first:pl-4 first:text-left last:pr-4"

/** Одна шкала: факт к плану и черта «положено к сегодня по рабочим дням» */
function PlanBar({ plan }: { plan: Plan }) {
  if (!plan.target) return <span className="text-meta text-muted-foreground">план не задан</span>
  const progress = Math.min(plan.fact / plan.target, 1)
  const expected = plan.expectedToDate !== null ? Math.min(plan.expectedToDate / plan.target, 1) : null
  const behind = plan.expectedToDate !== null && plan.fact < plan.expectedToDate
  return (
    <div className="flex min-w-40 items-center gap-2">
      <div className="relative h-1.5 flex-1 rounded-full bg-muted" role="img" aria-label={`Выполнено ${formatPercent(progress)}`}>
        <div className={cn("h-full rounded-full", behind ? "bg-warning" : "bg-success")} style={{ width: `${progress * 100}%` }} />
        {expected !== null && <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-foreground/70" style={{ left: `${expected * 100}%` }} aria-hidden />}
      </div>
      <span className="w-10 text-right text-meta tabular-nums">{formatPercent(plan.fact / plan.target)}</span>
    </div>
  )
}

export function PlanFactTab({ data }: { data: TeamToday }) {
  const rows: { key: string; name: React.ReactNode; row: TeamRow | null; plan: Plan }[] = [
    ...data.rows.map((row) => ({
      key: row.manager.id,
      name: (
        <div>
          <Link href={cabinetLinks.member(row.manager.id)} className="font-medium hover:underline">
            {row.manager.name}
          </Link>
          {row.absence && (
            <p>
              <AbsenceLabel absence={row.absence} />
            </p>
          )}
        </div>
      ),
      row,
      plan: row.plan,
    })),
    { key: "department", name: <span className="font-semibold">Отдел</span>, row: null, plan: data.department.plan },
  ]

  return (
    <CabinetSection
      id="cabinet-plan"
      title={`План — факт · ${data.workDay.monthLabel}`}
      description={
        <>
          Рабочий день {data.workDay.number} из {data.workDay.total}. Черта на шкале — сколько положено к сегодня по рабочим дням сотрудника.
        </>
      }
    >
      <ListPanel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
              <tr>
                <th scope="col" className={TH}>Сотрудник</th>
                <th scope="col" className={TH}><MetricLabel metric="sale">План</MetricLabel></th>
                <th scope="col" className={TH}>Факт</th>
                <th scope="col" className={cn(TH, "text-left")}>Выполнение</th>
                <th scope="col" className={TH}>Осталось</th>
                <th scope="col" className={TH}><MetricLabel metric="workDay">Раб. дней</MetricLabel></th>
                <th scope="col" className={TH}>Нужно в день</th>
                <th scope="col" className={TH}><MetricLabel metric="forecast">Прогноз</MetricLabel></th>
                <th scope="col" className={TH}><MetricLabel metric="chain">Нужно встреч</MetricLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ key, name, plan }) => (
                <tr key={key} className={cn(key === "department" && "border-t-2 bg-muted/30")}>
                  <td className={TD}>{name}</td>
                  <td className={TD}>{plan.target !== null ? formatNumber(plan.target) : <span className="text-muted-foreground">не задан</span>}</td>
                  <td className={cn(TD, "font-semibold")}>{formatNumber(plan.fact)}</td>
                  <td className={cn(TD, "text-left")}>
                    <PlanBar plan={plan} />
                  </td>
                  <td className={TD}>{plan.remaining !== null ? formatNumber(plan.remaining) : "—"}</td>
                  <td className={TD}>
                    {formatNumber(plan.workDaysLeft)} <span className="text-xs text-muted-foreground">из {formatNumber(plan.workDaysTotal)}</span>
                  </td>
                  <td className={TD}>{plan.perDayNeeded !== null ? formatDecimal(plan.perDayNeeded) : "—"}</td>
                  <td className={cn(TD, "text-muted-foreground")}>{plan.forecast !== null ? `≈ ${formatDecimal(plan.forecast)}` : "—"}</td>
                  <td className={TD}>
                    {plan.meetingsHeldNeeded !== null ? (
                      <span>
                        {formatNumber(plan.meetingsHeldNeeded)} <span className="text-xs text-muted-foreground">→ назначить {formatNumber(plan.meetingsToBookNeeded ?? 0)}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListPanel>
      <p className="text-xs text-muted-foreground">
        Факт — клиенты с первым платежом в месяце. Прогноз — линейный, при текущем темпе. Задание планов появится после согласования API (сейчас у части сотрудников план не задан).
      </p>
    </CabinetSection>
  )
}

/** Шаги «назначено → подтверждено → состоялось → с оплатой» и потери отдельной строкой */
export function QualityTab({ data }: { data: TeamQuality }) {
  const { meetings } = data
  const flow = [
    { label: "Назначено", value: meetings.booked },
    { label: "Подтверждено", value: meetings.confirmed, metric: "confirmed" as const },
    { label: "Состоялось", value: meetings.held, metric: "held" as const },
    { label: "С оплатой", value: meetings.heldWithPayment },
  ]
  const losses = [
    { label: "Не дошёл", value: meetings.noShow },
    { label: "Отмена", value: meetings.cancelled },
    { label: "Перенос", value: meetings.rescheduled },
    { label: "Без итога", value: meetings.withoutOutcome, href: cabinetLinks.meetingsWithoutOutcome() },
  ]
  const max = Math.max(meetings.booked, 1)

  return (
    <div className="space-y-8">
      <CabinetSection id="cabinet-meetings" title="Итоги встреч" description={data.periodLabel}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <ol className="space-y-2">
              {flow.map((step) => (
                <li key={step.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{step.metric ? <MetricLabel metric={step.metric}>{step.label}</MetricLabel> : step.label}</span>
                  <span className="h-2 rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary/80" style={{ width: `${(step.value / max) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{formatNumber(step.value)}</span>
                </li>
              ))}
            </ol>
            <p className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-meta text-muted-foreground">
              {losses.map((loss) => (
                <span key={loss.label}>
                  {loss.label}:{" "}
                  {loss.href && loss.value > 0 ? (
                    <Link href={loss.href} className="font-semibold text-warning hover:underline">
                      {formatNumber(loss.value)}
                    </Link>
                  ) : (
                    <span className={cn("font-semibold", loss.value > 0 ? "text-foreground" : undefined)}>{formatNumber(loss.value)}</span>
                  )}
                </span>
              ))}
            </p>
            <p className="text-xs text-muted-foreground">Причины отмен появятся, когда backend начнёт их отдавать.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Состоялись, но без оплаты · {formatNumber(data.heldWithoutSale.length)}</h3>
            {data.heldWithoutSale.length === 0 ? (
              <p className="text-meta text-muted-foreground">Все состоявшиеся встречи закрылись оплатой.</p>
            ) : (
              <ListPanel>
                <ul className="divide-y">
                  {data.heldWithoutSale.map((item) => (
                    <li key={item.lead.id} className="relative px-3 py-2 transition-colors hover:bg-accent/40">
                      <Link href={leadRoute(item.lead.id)} className="text-sm font-medium after:absolute after:inset-0">
                        {item.lead.name}
                      </Link>
                      <p className="text-meta text-muted-foreground">
                        {item.manager.name} · {formatDateTime(item.meetingAt)} · {item.stageName}
                      </p>
                      <p className={cn("text-meta", item.nextStep ? "text-foreground/85" : "text-warning")}>
                        {item.nextStep ? `Шаг: ${item.nextStep}` : "Следующий шаг не назначен"}
                      </p>
                    </li>
                  ))}
                </ul>
              </ListPanel>
            )}
          </div>
        </div>
      </CabinetSection>

      <CabinetSection id="cabinet-calls" title="Качество звонков" description="Оценки и признаки разбора видны только руководителям">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <ListPanel>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
                  <tr>
                    <th scope="col" className={TH}>Менеджер</th>
                    <th scope="col" className={TH}><MetricLabel metric="callScore">Ср. оценка</MetricLabel></th>
                    <th scope="col" className={TH}><MetricLabel metric="goal">Цель</MetricLabel></th>
                    <th scope="col" className={TH}><MetricLabel metric="nextStepShare">Шаг с датой</MetricLabel></th>
                    <th scope="col" className={TH}>Оценено</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.calls.map((row) => (
                    <tr key={row.manager.id}>
                      <td className={TD}>
                        <Link href={cabinetLinks.calls(row.manager.id)} className="font-medium hover:underline">
                          {row.manager.name}
                        </Link>
                      </td>
                      <td className={cn(TD, row.avgScore !== null && row.avgScore < 3 && "font-semibold text-destructive")}>
                        {row.avgScore !== null ? formatDecimal(row.avgScore) : "—"}
                      </td>
                      <td className={TD}>{row.goalAchievedShare !== null ? formatPercent(row.goalAchievedShare) : "—"}</td>
                      <td className={TD}>{row.nextStepShare !== null ? formatPercent(row.nextStepShare) : "—"}</td>
                      <td className={cn(TD, "text-muted-foreground")}>
                        {formatNumber(row.rated)} из {formatNumber(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListPanel>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Послушать перед one-to-one</h3>
            {data.toListen.length === 0 ? (
              <p className="text-meta text-muted-foreground">Оценённых звонков пока нет.</p>
            ) : (
              <ListPanel>
                <ul className="divide-y">
                  {data.toListen.map((call) => (
                    <li key={call.callId} className="relative flex items-start gap-3 px-3 py-2 transition-colors hover:bg-accent/40">
                      <Headphones className={cn("mt-0.5 size-4 shrink-0", call.kind === "weak" ? "text-warning" : "text-success")} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <Link href={cabinetLinks.call(call.callId)} className="text-sm font-medium after:absolute after:inset-0">
                          {call.lead?.name ?? "Без лида"} · {call.manager.name.split(" ")[0]}
                        </Link>
                        <p className="line-clamp-2 text-meta text-muted-foreground">
                          {call.kind === "weak" ? "Слабый" : "Сильный"}: {call.summary}
                        </p>
                      </div>
                      <RatingStars score={call.score} />
                    </li>
                  ))}
                </ul>
              </ListPanel>
            )}
          </div>
        </div>
      </CabinetSection>
    </div>
  )
}

/** Воронка одним способом: строка на этап — сколько, сколько стоит, сколько висит и где скопление */
export function FunnelTab({ data }: { data: TeamFunnel }) {
  return (
    <div className="space-y-8">
      {data.pipelines.map((pipeline) => {
        const max = Math.max(...pipeline.stages.map((stage) => stage.count), 1)
        const total = pipeline.stages.reduce((sum, stage) => sum + stage.count, 0)
        return (
          <CabinetSection
            key={pipeline.id}
            id={`funnel-${pipeline.id}`}
            title={pipeline.name}
            description={`${formatNumber(total)} сделок в работе`}
            action={
              <Link href={`${routes.sales}?pipeline=${pipeline.id}`} className="text-meta text-primary hover:underline">
                Открыть доску →
              </Link>
            }
          >
            <ListPanel>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-sm">
                  <thead className="text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
                    <tr>
                      <th scope="col" className={TH}>Этап</th>
                      <th scope="col" className={cn(TH, "w-[40%] text-left")}>Сделок</th>
                      <th scope="col" className={TH}>Сумма</th>
                      <th scope="col" className={TH}>Медиана на этапе</th>
                      <th scope="col" className={TH}>Дольше {data.staleThresholdDays} дн.</th>
                      <th scope="col" className={TH}>Переход дальше</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pipeline.stages.map((stage) => (
                      <tr key={stage.id} className={cn(stage.isPile && "bg-warning/6")}>
                        <td className={TD}>
                          <span className="font-medium">{stage.name}</span>
                          {stage.isPile && <span className="ml-2 text-xs font-medium text-warning">скопление</span>}
                        </td>
                        <td className={cn(TD, "text-left")}>
                          <div className="flex items-center gap-2">
                            <span className="h-2 flex-1 rounded-full bg-muted">
                              <span
                                className={cn("block h-full rounded-full", stage.isPile ? "bg-warning" : "bg-primary/70")}
                                style={{ width: `${(stage.count / max) * 100}%` }}
                              />
                            </span>
                            <span className="w-6 text-right font-semibold">{formatNumber(stage.count)}</span>
                          </div>
                        </td>
                        <td className={cn(TD, "text-muted-foreground")}>
                          {stage.amount && stage.currency ? formatDecimalMoney(stage.amount, stage.currency) : "—"}
                        </td>
                        <td className={TD}>{stage.medianAgeDays !== null ? `${formatDecimal(stage.medianAgeDays)} дн.` : "—"}</td>
                        <td className={cn(TD, stage.staleCount > 0 && "font-semibold text-warning")}>{formatNumber(stage.staleCount)}</td>
                        <td className={cn(TD, "text-muted-foreground")}>{stage.conversionToNext !== null ? formatPercent(stage.conversionToNext) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ListPanel>
          </CabinetSection>
        )
      })}
      <p className="text-xs text-muted-foreground">
        Конверсия между этапами и динамика к прошлой неделе появятся, когда backend начнёт отдавать историю переходов: без неё значения не показываем.
      </p>
    </div>
  )
}
