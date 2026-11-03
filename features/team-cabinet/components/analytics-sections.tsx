import { ApiErrorState } from "@/components/shared/api-error-state"
import { ListPanel } from "@/components/shared/list-panel"
import { MetricHint } from "@/components/shared/metric-hint"
import { routes } from "@/config/routes"
import {
  changeLabel,
  fetchFunnelReport,
  fetchLossReport,
  type LossReport,
  type ReasonCount,
} from "@/features/team-cabinet/api/analytics"
import { CabinetSection, NumLink } from "@/features/team-cabinet/components/cabinet-parts"
import { cabinetMoney } from "@/features/team-cabinet/lib/money"
import { tryLoad } from "@/lib/api/load"
import { formatDayMonth, formatDecimal, formatNumber, formatPercent } from "@/lib/format"
import { getParam, type SearchParamsRecord } from "@/lib/search-params"
import { cn } from "@/lib/utils"

/** Определения метрик вкладок «Воронка» и «Потери» — то же, что описано в API backend */
export const ANALYTICS_DEFINITIONS = {
  reached: "Сделки, которые попали на этап в выбранный период: созданы на нём или переведены на него.",
  conversion: "Из попавших на этап за период — доля тех, что потом перешли на следующий этап воронки или были выиграны.",
  age: "Медиана дней с момента, когда открытая сделка попала на свой текущий этап, — на сегодня.",
  stale: "Открытые сделки, которые стоят на этапе дольше выбранного порога (по умолчанию 14 дней).",
  bottleneck: "Открытый этап с самой низкой конверсией среди этапов, куда за период попало не меньше 3 сделок; если таких нет — этап с наибольшим числом зависших сделок.",
  lossReasons: "Сделки, закрытые как проигранные в периоде, по причине отказа из справочника компании (иначе — по тексту причины). По месяцу закрытия в часовом поясе компании.",
  meetingReasons: "Встречи, назначенные на даты периода: отменённые — по причине отмены, «не пришёл» — по причине неявки.",
  leadResponse: "Лиды, созданные в периоде. Первый ответ — самое раннее действие по лиду (звонок, сообщение, задача) или его квалификация, отказ, конвертация или правка сотрудником.",
} as const

const th = "px-3 py-2 text-left font-medium text-muted-foreground"
const td = "px-3 py-2 tabular-nums"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const dateParam = (params: SearchParamsRecord, name: string) => {
  const value = getParam(params, name)
  return value && DATE_RE.test(value) ? value : null
}

function Hint({ label, definition }: { label: string; definition: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <MetricHint label={label} definition={definition} />
    </span>
  )
}

/** Фильтр периода вкладки: обычная GET-форма, вкладка сохраняется */
function PeriodForm({ tab, dateFrom, dateTo, extra }: { tab: string; dateFrom: string; dateTo: string; extra?: React.ReactNode }) {
  return (
    <form className="flex flex-wrap items-end gap-2" action={routes.team}>
      <input type="hidden" name="tab" value={tab} />
      <label className="grid gap-1 text-meta text-muted-foreground">
        С
        <input type="date" name="date_from" defaultValue={dateFrom} className="h-8 rounded-md border bg-background px-2 text-sm text-foreground" />
      </label>
      <label className="grid gap-1 text-meta text-muted-foreground">
        По
        <input type="date" name="date_to" defaultValue={dateTo} className="h-8 rounded-md border bg-background px-2 text-sm text-foreground" />
      </label>
      {extra}
      <button type="submit" className="h-8 rounded-md px-3 text-sm ring-1 ring-border hover:bg-muted">
        Показать
      </button>
    </form>
  )
}

function Comparison({ current, previous }: { current: number; previous: number }) {
  const label = changeLabel(current, previous)
  return label ? <span className="text-meta text-muted-foreground">{label}</span> : null
}

const ratio = (value: string | null) => (value === null ? "—" : formatPercent(Number(value)))

export async function FunnelSection({ params }: { params: SearchParamsRecord }) {
  const staleRaw = Number(getParam(params, "stale_days"))
  const result = await tryLoad(() =>
    fetchFunnelReport({
      pipelineId: getParam(params, "pipeline") ?? null,
      dateFrom: dateParam(params, "date_from"),
      dateTo: dateParam(params, "date_to"),
      staleDays: Number.isInteger(staleRaw) && staleRaw >= 1 && staleRaw <= 365 ? staleRaw : null,
    })
  )
  if (!result.ok) return <ApiErrorState error={result.error} />
  if (!result.data) {
    return <p className="text-sm text-muted-foreground">Воронка продаж ещё не настроена — анализу не на чем строиться.</p>
  }
  const { report, pipelines } = result.data
  const bottleneck = report.stages.find((stage) => stage.isBottleneck)

  return (
    <CabinetSection
      id="team-funnel"
      title={`Воронка · ${report.pipelineName}`}
      description={`Период ${formatDayMonth(report.dateFrom)} — ${formatDayMonth(report.dateTo)}; сравнение с ${formatDayMonth(report.previousFrom)} — ${formatDayMonth(report.previousTo)}. Открытые сделки и возраст — на сейчас.`}
      action={
        <PeriodForm
          tab="funnel"
          dateFrom={report.dateFrom}
          dateTo={report.dateTo}
          extra={
            <>
              {pipelines.length > 1 && (
                <label className="grid gap-1 text-meta text-muted-foreground">
                  Воронка
                  <select name="pipeline" defaultValue={report.pipelineId} className="h-8 rounded-md border bg-background px-2 text-sm text-foreground">
                    {pipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="grid gap-1 text-meta text-muted-foreground">
                Зависла, дней
                <input type="number" name="stale_days" min={1} max={365} defaultValue={report.staleDays} className="h-8 w-20 rounded-md border bg-background px-2 text-sm text-foreground" />
              </label>
            </>
          }
        />
      }
    >
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Выиграно за период" value={report.won} previous={report.wonPrevious} />
        <Stat label="Проиграно за период" value={report.lost} previous={report.lostPrevious} />
        <div className="col-span-2 rounded-xl px-4 py-3 ring-1 ring-border">
          <dt className="text-meta text-muted-foreground">
            <Hint label="Узкое место" definition={ANALYTICS_DEFINITIONS.bottleneck} />
          </dt>
          <dd className="text-base font-semibold">{bottleneck ? bottleneck.name : "не выявлено"}</dd>
          {bottleneck && (
            <p className="text-meta text-muted-foreground">
              конверсия {ratio(bottleneck.conversion)} · зависло {formatNumber(bottleneck.staleDeals)}
            </p>
          )}
        </div>
      </dl>
      <ListPanel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b">
              <tr>
                <th className={th}>Этап</th>
                <th className={th}><Hint label="Попали за период" definition={ANALYTICS_DEFINITIONS.reached} /></th>
                <th className={th}><Hint label="Конверсия дальше" definition={ANALYTICS_DEFINITIONS.conversion} /></th>
                <th className={th}>Открыто сейчас</th>
                <th className={th}>Сумма</th>
                <th className={th}><Hint label="Медиана дней на этапе" definition={ANALYTICS_DEFINITIONS.age} /></th>
                <th className={th}><Hint label="Зависли" definition={ANALYTICS_DEFINITIONS.stale} /></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.stages.map((stage) => (
                <tr key={stage.stageId} className={cn(stage.isBottleneck && "bg-warning/10")}>
                  <td className="px-3 py-2 font-medium">
                    {stage.name}
                    {stage.isBottleneck && <span className="ml-2 text-xs font-normal text-warning">узкое место</span>}
                  </td>
                  <td className={td}>
                    {formatNumber(stage.reached)}
                    <span className="ml-1.5 text-meta text-muted-foreground">было {formatNumber(stage.reachedPrevious)}</span>
                  </td>
                  <td className={td}>{stage.kind === "open" ? ratio(stage.conversion) : "—"}</td>
                  <td className={td}>{stage.kind === "open" ? formatNumber(stage.openDeals) : "—"}</td>
                  <td className={td}>{stage.kind === "open" ? cabinetMoney(stage.openAmount, report.currency) : "—"}</td>
                  <td className={td}>{stage.medianAgeDays === null ? "—" : formatDecimal(Number(stage.medianAgeDays))}</td>
                  <td className={td}>{stage.kind === "open" ? <NumLink value={stage.staleDeals} tone="warning" /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListPanel>
      <p className="text-meta text-muted-foreground">Суммы — только сделки в валюте компании. Архивные этапы не показываются.</p>
    </CabinetSection>
  )
}

function Stat({ label, value, previous, hint }: { label: string; value: number; previous: number; hint?: string }) {
  return (
    <div className="rounded-xl px-4 py-3 ring-1 ring-border">
      <dt className="text-meta text-muted-foreground">{hint ? <Hint label={label} definition={hint} /> : label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{formatNumber(value)}</dd>
      <Comparison current={value} previous={previous} />
    </div>
  )
}

export async function LossesSection({ params }: { params: SearchParamsRecord }) {
  const result = await tryLoad(() => fetchLossReport(dateParam(params, "date_from"), dateParam(params, "date_to")))
  if (!result.ok) return <ApiErrorState error={result.error} />
  const report = result.data
  const lead = report.leadResponse

  return (
    <div className="space-y-6">
      <CabinetSection
        id="team-loss-reasons"
        title="Причины отказа"
        description={`Период ${formatDayMonth(report.dateFrom)} — ${formatDayMonth(report.dateTo)}; сравнение с ${formatDayMonth(report.previousFrom)} — ${formatDayMonth(report.previousTo)}.`}
        action={<PeriodForm tab="losses" dateFrom={report.dateFrom} dateTo={report.dateTo} />}
      >
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Проигранных сделок" value={report.lostDeals} previous={report.lostPrevious} hint={ANALYTICS_DEFINITIONS.lossReasons} />
          <Stat label="Встреч отменено" value={report.meetingsCancelled} previous={report.cancelledPrevious} hint={ANALYTICS_DEFINITIONS.meetingReasons} />
          <Stat label="Клиент не пришёл" value={report.meetingsNoShow} previous={report.noShowPrevious} hint={ANALYTICS_DEFINITIONS.meetingReasons} />
          <div className="rounded-xl px-4 py-3 ring-1 ring-border">
            <dt className="text-meta text-muted-foreground">Встреч в периоде</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatNumber(report.meetingsTotal)}</dd>
          </div>
        </dl>
        <ReasonTable title="Сделки" reasons={report.lossReasons} months={report.months} empty="Проигранных сделок за период нет." />
      </CabinetSection>

      <CabinetSection id="team-meeting-reasons" title="Отмены и неявки встреч" description="Причины выбирают из справочника компании или пишут своими словами.">
        <ReasonTable title="Отмены" reasons={report.cancelReasons} months={report.months} empty="Отменённых встреч нет." />
        <ReasonTable title="Не пришли" reasons={report.noShowReasons} months={report.months} empty="Неявок нет." />
      </CabinetSection>

      <CabinetSection id="team-lead-response" title="Скорость первого ответа лиду" description={ANALYTICS_DEFINITIONS.leadResponse}>
        {lead.leads === 0 ? (
          <p className="text-sm text-muted-foreground">Новых лидов за период нет.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure label="Новых лидов" value={formatNumber(lead.leads)} />
            <Figure label="С ответом" value={`${formatNumber(lead.responded)} · ${formatPercent(lead.responded / lead.leads)}`} />
            <Figure label="Медиана до ответа" value={lead.medianMinutes === null ? "—" : `${formatDecimal(Number(lead.medianMinutes))} мин`} />
            <Figure label="За 15 / 60 минут" value={`${formatNumber(lead.within15Min)} / ${formatNumber(lead.within60Min)}`} />
          </dl>
        )}
      </CabinetSection>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-4 py-3 ring-1 ring-border">
      <dt className="text-meta text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

const MONTH_NAMES = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
const monthLabel = (month: string) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month} ${month.slice(2, 4)}`

function ReasonTable({ title, reasons, months, empty }: { title: string; reasons: readonly ReasonCount[]; months: LossReport["months"]; empty: string }) {
  if (reasons.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  const total = reasons.reduce((sum, reason) => sum + reason.total, 0)
  return (
    <ListPanel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="border-b">
            <tr>
              <th className={th}>{title}: причина</th>
              <th className={th}>Всего</th>
              <th className={th}>Доля</th>
              {months.map((month) => (
                <th key={month} className={th}>
                  {monthLabel(month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {reasons.map((reason) => (
              <tr key={reason.reason}>
                <td className="px-3 py-2">{reason.reason}</td>
                <td className={cn(td, "font-medium")}>{formatNumber(reason.total)}</td>
                <td className={td}>{formatPercent(reason.total / total)}</td>
                {months.map((month) => (
                  <td key={month} className={td}>
                    <NumLink value={reason.byMonth[month] ?? 0} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListPanel>
  )
}
