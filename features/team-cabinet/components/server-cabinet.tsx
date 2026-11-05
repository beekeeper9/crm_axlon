import Link from "next/link"
import { connection } from "next/server"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { ListPanel } from "@/components/shared/list-panel"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { routes } from "@/config/routes"
import { listMembersIfAllowed } from "@/features/team"
import {
  fetchAbsences,
  fetchDepartments,
  fetchInactivity,
  fetchPlanHistory,
  fetchPlansProgress,
  type PlanProgressRow,
} from "@/features/team-cabinet/api/team-board"
import { FunnelSection, LossesSection } from "@/features/team-cabinet/components/analytics-sections"
import { AbsenceForm, PlanForm } from "@/features/team-cabinet/components/cabinet-forms"
import { KpiExport } from "@/features/team-cabinet/components/kpi-export"
import { DepartmentPlanSection } from "@/features/team-cabinet/components/department-plan"
import { FunnelStagesSection } from "@/features/team-cabinet/components/funnel-stages"
import { PlanFactSection, TeamDaySection } from "@/features/team-cabinet/components/team-day"
import { TODAY_WIDGETS, TodayActionsSection } from "@/features/team-cabinet/components/today-actions"
import { CabinetSection, LevelDot } from "@/features/team-cabinet/components/cabinet-parts"
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
  { value: "funnel", label: "Воронка" },
  { value: "losses", label: "Потери" },
] as const

type Tab = (typeof TABS)[number]["value"]

/**
 * «Мой кабинет» РОПа (директору — «Кабинет отдела»): сверху планы отдела в продажах и деньгах,
 * под ними «Что делать сегодня», ниже вкладки. Все числа считает backend.
 */
export async function ServerCabinetView({ params }: { params: SearchParamsRecord }) {
  // Месяц и «сегодня» — момент запроса, а не сборки: страница всегда рендерится на запрос
  await connection()
  const user = await getCurrentUser()
  const isDirector = hasPermission(user.role, "company.view")
  const tabParam = getParam(params, "tab")
  const tab: Tab = TABS.find((item) => item.value === tabParam)?.value ?? "today"
  const focusParam = getParam(params, "focus")
  const focus = TODAY_WIDGETS.find((widget) => widget === focusParam) ?? null
  const href = (patch: Record<string, string | null>) => hrefWithParams(routes.team, params, patch)

  return (
    <div className="space-y-6">
      <h1 className="sr-only">{isDirector ? "Кабинет отдела" : "Мой кабинет"}</h1>
      <DepartmentPlanSection
        plansHref={isDirector ? href({ tab: "plans" }) : null}
        action={<KpiExport defaultStart={`${currentMonth()}-01`} defaultEnd={companyDateOf(nowIso())} />}
      />
      <TodayActionsSection focus={focus} params={params} />
      <div className="border-b">
        <SegmentedLinks
          label="Разделы кабинета"
          items={TABS.map((item) => ({ key: item.value, label: item.label, href: href({ tab: item.value === "today" ? null : item.value }), isActive: item.value === tab }))}
        />
      </div>
      {tab === "today" && <TeamDaySection params={params} />}
      {tab === "plan" && <PlanFactSection />}
      {tab === "plans" && <PlansSection params={params} />}
      {tab === "silence" && <SilenceSection />}
      {tab === "funnel" && (
        <div className="space-y-8">
          <FunnelSection params={params} />
          <FunnelStagesSection pipelineId={getParam(params, "pipeline")} isDirector={isDirector} />
        </div>
      )}
      {tab === "losses" && <LossesSection params={params} />}
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

const th = "px-3 py-2 text-left font-medium text-muted-foreground"
const td = "px-3 py-2 tabular-nums"
