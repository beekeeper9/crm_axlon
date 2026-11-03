import Link from "next/link"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { ListPanel } from "@/components/shared/list-panel"
import { MetricHint } from "@/components/shared/metric-hint"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { routes, teamMemberRoute } from "@/config/routes"
import { listMembersIfAllowed } from "@/features/team"
import {
  fetchAbsences,
  fetchDepartments,
  fetchInactivity,
  fetchPlanHistory,
  fetchPlansProgress,
  fetchTeamBoard,
  fetchTeamPlanFact,
  type DayScore,
  type PlanProgressRow,
  type TeamBoard,
  type TeamPlanFact,
} from "@/features/team-cabinet/api/team-board"
import { AbsenceForm, PlanForm } from "@/features/team-cabinet/components/cabinet-forms"
import { KpiExport } from "@/features/team-cabinet/components/kpi-export"
import { CabinetSection, LevelDot, NumLink } from "@/features/team-cabinet/components/cabinet-parts"
import { ABSENCE_LABELS, PLAN_METRIC_LABELS } from "@/features/team-cabinet/lib/plan-absence-meta"
import { tryLoad } from "@/lib/api/load"
import { nowIso } from "@/lib/clock"
import { companyDateOf } from "@/lib/datetime"
import { formatDateTime, formatDayMonth, formatDecimal, formatDecimalMoney, formatNumber, formatTime } from "@/lib/format"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"
import { getParam, hrefWithParams, type SearchParamsRecord } from "@/lib/search-params"

const TABS = [
  { value: "today", label: "Сегодня" },
  { value: "plan", label: "План — факт" },
  { value: "plans", label: "Планы" },
  { value: "silence", label: "Тишина и отсутствия" },
] as const

type Tab = (typeof TABS)[number]["value"]

/** Правила светофора backend простыми словами */
const REASONS: Record<string, string> = {
  no_activity: "Нет активности за рабочий день",
  meeting_without_outcome: "Встреча прошла, итог не записан",
  morning_confirmations_below_threshold: "Мало подтверждённых утренних встреч",
  overdue_tasks: "Есть просроченные задачи",
  reschedules_without_date: "Переносы без новой даты",
}

const meetingsOf = (userId: string) => hrefWithParams(routes.meetings, {}, { host: userId })
const tasksOf = (userId: string) => hrefWithParams(routes.tasks, {}, { assignee: userId })

/**
 * «Мой кабинет» РОПа (директору — «Кабинет отдела»): план отдела сверху, затем день отдела,
 * план-факт, планы и тишина. Все числа считает backend.
 */
export async function ServerCabinetView({ params }: { params: SearchParamsRecord }) {
  const user = await getCurrentUser()
  const title = hasPermission(user.role, "company.view") ? "Кабинет отдела" : "Мой кабинет"
  const tabParam = getParam(params, "tab")
  const tab: Tab = TABS.find((item) => item.value === tabParam)?.value ?? "today"
  const href = (patch: Record<string, string | null>) => hrefWithParams(routes.team, params, patch)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-meta text-muted-foreground">Показатели считает сервер; продажа — каждая сделка с первой оплатой.</p>
        </div>
        <KpiExport defaultStart={`${currentMonth()}-01`} defaultEnd={companyDateOf(nowIso())} />
      </header>
      <DepartmentPlanSection plansHref={hasPermission(user.role, "company.view") ? href({ tab: "plans" }) : null} />
      <div className="border-b">
        <SegmentedLinks
          label="Разделы кабинета"
          items={TABS.map((item) => ({ key: item.value, label: item.label, href: href({ tab: item.value === "today" ? null : item.value }), isActive: item.value === tab }))}
        />
      </div>
      {tab === "today" && <TodaySection />}
      {tab === "plan" && <PlanFactSection />}
      {tab === "plans" && <PlansSection params={params} />}
      {tab === "silence" && <SilenceSection />}
    </div>
  )
}

/** Текущий месяц компании (ГГГГ-ММ) */
const currentMonth = () => companyDateOf(nowIso()).slice(0, 7)

async function PlansSection({ params }: { params: SearchParamsRecord }) {
  const period = /^\d{4}-\d{2}$/.test(getParam(params, "period") ?? "") ? (getParam(params, "period") as string) : currentMonth()
  const historyId = getParam(params, "history")
  const user = await getCurrentUser()
  const loaded = await tryLoad(async () => {
    const [departments, members] = await Promise.all([fetchDepartments().catch(() => []), listMembersIfAllowed()])
    const plans = await fetchPlansProgress(period, new Map(departments.map((d) => [d.id, d.name])))
    return { departments, members, plans }
  })
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const { departments, members, plans } = loaded.data
  const history = historyId ? await tryLoad(() => fetchPlanHistory(historyId)) : null
  const href = (patch: Record<string, string | null>) => hrefWithParams(routes.team, params, patch)
  const amount = (plan: PlanProgressRow, value: string) => (plan.unit === "money" && plan.currency ? formatDecimalMoney(value, plan.currency) : formatDecimal(Number(value)))

  return (
    <CabinetSection
      id="team-plans"
      title={`Планы · ${period}`}
      description="Факт и процент считает сервер. План компании и отдела задаёт директор, план менеджера — ещё и РОП. Каждое изменение сохраняется в истории."
      action={
        <form className="flex items-center gap-2" action={routes.team}>
          <input type="hidden" name="tab" value="plans" />
          <input type="month" name="period" defaultValue={period} aria-label="Месяц" className="h-8 rounded-md border bg-background px-2 text-sm" />
          <button type="submit" className="h-8 rounded-md px-2 text-sm ring-1 ring-border hover:bg-muted">Показать</button>
        </form>
      }
    >
      <PlanForm
        members={members.map((m) => ({ value: m.id, label: m.name }))}
        departments={departments.map((d) => ({ value: d.id, label: d.name }))}
        canCompany={hasPermission(user.role, "company.view")}
        period={period}
      />
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">На этот месяц планов нет — задайте план, чтобы видеть выполнение.</p>
      ) : (
        <ListPanel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="border-b">
                <tr>
                  <th className={th}>Кому</th>
                  <th className={th}>Показатель</th>
                  <th className={th}>План</th>
                  <th className={th}>Факт</th>
                  <th className={th}>Выполнение</th>
                  <th className={th}>Осталось</th>
                  <th className={th}>История</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="px-3 py-2 font-medium">{plan.scopeName}</td>
                    <td className="px-3 py-2">{PLAN_METRIC_LABELS[plan.metric]}</td>
                    <td className={td}>{amount(plan, plan.target)}</td>
                    <td className={td}>{plan.actual === null ? "—" : amount(plan, plan.actual)}</td>
                    <td className={td}>{plan.percent === null ? "—" : `${formatNumber(Math.round(Number(plan.percent)))}%`}</td>
                    <td className={td}>{plan.remaining === null ? "—" : amount(plan, plan.remaining)}</td>
                    <td className="px-3 py-2">
                      <Link href={href({ history: historyId === plan.id ? null : plan.id })} className="text-primary hover:underline">
                        {historyId === plan.id ? "Скрыть" : "Показать"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListPanel>
      )}
      {history && (
        history.ok ? (
          <ol className="space-y-1 text-sm">
            {history.data.map((change) => (
              <li key={change.id} className="text-muted-foreground">
                {formatDateTime(change.createdAt)} · {change.author}:{" "}
                <span className="text-foreground tabular-nums">
                  {change.oldTarget === null ? "задан" : `${formatDecimal(Number(change.oldTarget))} →`} {formatDecimal(Number(change.newTarget))}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <ApiErrorState error={history.error} bare />
        )
      )}
    </CabinetSection>
  )
}

async function SilenceSection() {
  const [inactive, absences, members] = await Promise.all([
    tryLoad(fetchInactivity),
    tryLoad(() => fetchAbsences(60)),
    tryLoad(listMembersIfAllowed),
  ])
  return (
    <div className="space-y-6">
      <CabinetSection id="team-silence" title="Нет активности сегодня" description="Ни звонков, ни встреч, ни оплат за рабочий день, и сотрудник не в запланированном отсутствии. Считает сервер.">
        {!inactive.ok ? (
          <ApiErrorState error={inactive.error} bare />
        ) : inactive.data.managers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Сегодня все с активностью или в запланированном отсутствии.</p>
        ) : (
          <ul className="divide-y rounded-xl ring-1 ring-border">
            {inactive.data.managers.map((row) => (
              <li key={row.userId} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <LevelDot level={row.status} />
                <span className="font-medium">{row.name}</span>
                <span className="text-muted-foreground">· нет активности (данные на {formatTime(inactive.data.asOf)})</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-meta text-muted-foreground">Сколько дней подряд нет активности, backend пока не считает.</p>
      </CabinetSection>

      <CabinetSection id="team-absences" title="Отсутствия" description="С начала месяца и на 60 дней вперёд. Запланированное отсутствие не даёт сигнала «нет активности»; «не вышел без предупреждения» — даёт.">
        {members.ok && <AbsenceForm members={members.data.map((m) => ({ value: m.id, label: m.name }))} />}
        {!absences.ok ? (
          <ApiErrorState error={absences.error} bare />
        ) : absences.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Отсутствий не отмечено.</p>
        ) : (
          <ul className="divide-y rounded-xl ring-1 ring-border">
            {absences.data.map((absence) => (
              <li key={absence.id} className="flex flex-wrap items-baseline gap-x-2 px-4 py-2.5 text-sm">
                <span className="font-medium">{absence.name}</span>
                <span>{ABSENCE_LABELS[absence.kind]}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatDayMonth(absence.startDate)} — {formatDayMonth(absence.endDate)}
                </span>
                {absence.comment && <span className="text-muted-foreground">· {absence.comment}</span>}
              </li>
            ))}
          </ul>
        )}
      </CabinetSection>
    </div>
  )
}

/** План отдела на месяц против факта; без плана отдела — предложение его задать */
async function DepartmentPlanSection({ plansHref }: { plansHref: string | null }) {
  const result = await tryLoad(fetchTeamPlanFact)
  if (!result.ok) return <ApiErrorState error={result.error} bare />
  const pf = result.data
  // Директор без выбранного отдела смотрит всю компанию — у неё свой план на странице «Продажи»
  if (!pf.departmentId) return null
  const percent = pf.departmentPercent === null ? null : Number(pf.departmentPercent)
  return (
    <section aria-labelledby="department-plan" className="space-y-2 rounded-xl px-4 py-3 ring-1 ring-border">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="department-plan" className="text-base font-semibold">
          План отдела · {pf.month}
        </h2>
        <span className="text-meta text-muted-foreground">
          Осталось рабочих дней: {formatNumber(pf.workingDaysLeft)} (календарных — рабочий календарь не настроен)
        </span>
      </div>
      {pf.departmentPlanSales === null ? (
        <p className="text-sm text-muted-foreground">
          План отдела на этот месяц не задан. Продаж по отделу: <span className="font-medium text-foreground">{formatNumber(pf.salesActualTotal)}</span>.{" "}
          {plansHref ? (
            <Link href={plansHref} className="text-primary hover:underline">
              Задать план отдела
            </Link>
          ) : (
            "План отдела задаёт директор."
          )}
        </p>
      ) : (
        <>
          <p className="text-sm">
            <span className="text-2xl font-semibold tabular-nums">{formatNumber(pf.salesActualTotal)}</span>
            <span className="text-muted-foreground"> из {formatDecimal(Number(pf.departmentPlanSales))} продаж</span>
            {percent !== null && <span className="ml-2 font-medium tabular-nums">{formatDecimal(percent)}%</span>}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percent ?? 0, 100)}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(percent ?? 0, 100)}%` }} />
          </div>
          <p className="text-meta text-muted-foreground">
            Осталось: {formatDecimal(Number(pf.departmentRemaining ?? 0))} · нужно в день: {formatDecimal(Number(pf.departmentPerDayNeeded ?? 0))} · сумма личных планов: {formatDecimal(Number(pf.planSalesTotal))}
          </p>
        </>
      )}
    </section>
  )
}

async function TodaySection() {
  const result = await tryLoad(fetchTeamBoard)
  return result.ok ? <TodayTable board={result.data} /> : <ApiErrorState error={result.error} />
}

async function PlanFactSection() {
  const result = await tryLoad(fetchTeamPlanFact)
  return result.ok ? <PlanFactTable planFact={result.data} /> : <ApiErrorState error={result.error} />
}

const th = "px-3 py-2 text-left font-medium text-muted-foreground"
const td = "px-3 py-2 tabular-nums"

const SCORE_DEFINITION =
  "0–100 баллов: до 50 — результат (продажи месяца против плана, пропорционально прошедшим дням), до 50 — дисциплина CRM (итоги прошедших встреч, подтверждения, переносы с датой, нет просроченных задач). Без личного плана считается только дисциплина (×2). 5 — от 90, 4 — 75–89, 3 — 60–74, 2 — ниже 60. Без активности за день и в плановом отсутствии оценки нет. Пороги — предложение ТЗ, владелец может их изменить."

const GRADE_TONES: Record<number, string> = {
  5: "bg-success/15 text-success",
  4: "bg-success/10 text-success",
  3: "bg-warning/15 text-warning",
  2: "bg-destructive/15 text-destructive",
}

function ScoreBadge({ score }: { score: DayScore | null }) {
  if (!score) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${GRADE_TONES[score.grade] ?? ""}`}
      title={`${score.points} баллов: результат ${score.result ?? "— (нет плана)"}, дисциплина ${score.discipline}`}
    >
      {score.grade}
      <span className="font-normal opacity-80">· {score.points}</span>
    </span>
  )
}

function TodayTable({ board }: { board: TeamBoard }) {
  const { totals } = board
  return (
    <CabinetSection
      id="team-today"
      title="День отдела"
      description={`Данные на ${formatTime(board.asOf)} · нужно вмешаться: ${formatNumber(totals.red)}, есть хвосты: ${formatNumber(totals.yellow)}, в порядке: ${formatNumber(totals.green)}`}
    >
      {board.managers.length === 0 ? (
        <p className="text-sm text-muted-foreground">В отделе пока нет менеджеров.</p>
      ) : (
        <ListPanel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[72rem] text-sm">
              <thead className="border-b">
                <tr>
                  <th className={th}>Сотрудник</th>
                  <th className={th}>
                    <span className="inline-flex items-center gap-1">
                      Оценка дня
                      <MetricHint label="Оценка дня" definition={SCORE_DEFINITION} isOpenQuestion />
                    </span>
                  </th>
                  <th className={th}>Встречи</th>
                  <th className={th}>Подтверждено</th>
                  <th className={th}>Осталось подтвердить</th>
                  <th className={th}>Состоялись</th>
                  <th className={th}>Не пришли</th>
                  <th className={th}>Перенос без даты</th>
                  <th className={th}>Отмена</th>
                  <th className={th}>Без итога</th>
                  <th className={th}>Звонки</th>
                  <th className={th}>Оплаты</th>
                  <th className={th}>Получено</th>
                  <th className={th}>Задачи: сегодня · открыто / просрочено</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {board.managers.map((row) => {
                  const reasons = [...row.redReasons, ...row.yellowReasons].map((code) => REASONS[code] ?? code)
                  return (
                    <tr key={row.userId} className="align-top">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <LevelDot level={row.status} />
                          <Link href={teamMemberRoute(row.userId)} className="font-medium hover:text-primary hover:underline">
                            {row.name}
                          </Link>
                        </div>
                        {row.onAbsence && <p className="text-xs text-muted-foreground">Отсутствует по графику</p>}
                        {reasons.length > 0 && <p className="text-xs text-muted-foreground">{reasons.join(" · ")}</p>}
                      </td>
                      <td className="px-3 py-2"><ScoreBadge score={row.score} /></td>
                      <td className={td}><NumLink value={row.meetingsTotal} href={meetingsOf(row.userId)} /></td>
                      <td className={td}><NumLink value={row.meetingsConfirmed} /></td>
                      <td className={td}>
                        <NumLink value={row.meetingsToConfirm} tone="warning" href={meetingsOf(row.userId)} />
                        {row.nextToConfirmAt && <span className="block text-xs text-muted-foreground">ближайшая {formatTime(row.nextToConfirmAt)}</span>}
                      </td>
                      <td className={td}><NumLink value={row.meetingsHeld} /></td>
                      <td className={td}><NumLink value={row.meetingsNoShow} tone="warning" /></td>
                      <td className={td}><NumLink value={row.reschedulesWithoutDate} tone="warning" href={hrefWithParams(routes.meetings, {}, { host: row.userId, status: "rescheduled" })} /></td>
                      <td className={td}><NumLink value={row.meetingsCancelled} /></td>
                      <td className={td}>
                        <NumLink value={row.meetingsOverdueOutcome} tone="danger" href={hrefWithParams(routes.meetings, {}, { host: row.userId, outcome: "required" })} />
                      </td>
                      <td className={td}><NumLink value={row.calls} /></td>
                      <td className={td}><NumLink value={row.paymentsCount} /></td>
                      <td className={td}>{formatDecimal(Number(row.received))}</td>
                      <td className={td}>
                        <NumLink value={row.tasksDueToday} href={hrefWithParams(routes.tasks, {}, { assignee: row.userId, due: "today" })} />
                        {" · "}
                        <Link href={tasksOf(row.userId)} className="rounded underline-offset-2 hover:underline">
                          {formatNumber(row.openTasks)}
                        </Link>
                        {" / "}
                        <NumLink value={row.overdueTasks} tone="danger" href={hrefWithParams(routes.tasks, {}, { assignee: row.userId, due: "overdue" })} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t font-medium">
                <tr>
                  <td className="px-3 py-2">Отдел · {formatNumber(totals.managers)}</td>
                  <td className={td} />
                  <td className={td}>{formatNumber(totals.meetingsTotal)}</td>
                  <td className={td}>{formatNumber(totals.meetingsConfirmed)}</td>
                  <td className={td}>{formatNumber(totals.meetingsToConfirm)}</td>
                  <td className={td}>{formatNumber(totals.meetingsHeld)}</td>
                  <td className={td}>{formatNumber(totals.meetingsNoShow)}</td>
                  <td className={td}>{formatNumber(totals.reschedulesWithoutDate)}</td>
                  <td className={td}>{formatNumber(totals.meetingsCancelled)}</td>
                  <td className={td}>{formatNumber(totals.meetingsOverdueOutcome)}</td>
                  <td className={td}>{formatNumber(totals.calls)}</td>
                  <td className={td}>{formatNumber(totals.paymentsCount)}</td>
                  <td className={td}>{formatDecimal(Number(totals.received))}</td>
                  <td className={td}>
                    {formatNumber(totals.openTasks)} / {formatNumber(totals.overdueTasks)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </ListPanel>
      )}
    </CabinetSection>
  )
}

function PlanFactTable({ planFact }: { planFact: TeamPlanFact }) {
  return (
    <CabinetSection
      id="team-plan-fact"
      title={`План — факт · ${planFact.month}`}
      description={`Прошло дней: ${formatNumber(planFact.workingDaysElapsed)} из ${formatNumber(planFact.workingDaysTotal)}. Прогноз — линейный по темпу, это оценка, а не факт.`}
    >
      {planFact.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">В отделе пока нет менеджеров.</p>
      ) : (
        <ListPanel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b">
                <tr>
                  <th className={th}>Сотрудник</th>
                  <th className={th}>План продаж</th>
                  <th className={th}>Продажи</th>
                  <th className={th}>Осталось</th>
                  <th className={th}>Прогноз</th>
                  <th className={th}>Получено</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {planFact.rows.map((row) => (
                  <tr key={row.userId}>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className={td}>{Number(row.planSales) > 0 ? formatDecimal(Number(row.planSales)) : <span className="text-muted-foreground">не задан</span>}</td>
                    <td className={td}>{formatNumber(row.salesActual)}</td>
                    <td className={td}>{formatDecimal(Number(row.remainingSales))}</td>
                    <td className={td}>{formatDecimal(Number(row.forecastSales))}</td>
                    <td className={td}>{formatDecimal(Number(row.receivedActual))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t font-medium">
                <tr>
                  <td className="px-3 py-2">Отдел</td>
                  <td className={td}>{formatDecimal(Number(planFact.planSalesTotal))}</td>
                  <td className={td}>{formatNumber(planFact.salesActualTotal)}</td>
                  <td className={td} />
                  <td className={td}>{formatDecimal(Number(planFact.forecastSalesTotal))}</td>
                  <td className={td}>{formatDecimal(Number(planFact.receivedTotal))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </ListPanel>
      )}
    </CabinetSection>
  )
}
