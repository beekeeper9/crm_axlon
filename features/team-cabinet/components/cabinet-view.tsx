import { CameraOff } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { routes } from "@/config/routes"
import { teamCabinetRepository } from "@/features/team-cabinet/api/team-cabinet-repository"
import { FunnelTab, PlanFactTab, QualityTab } from "@/features/team-cabinet/components/analysis-tabs"
import { TodayTab } from "@/features/team-cabinet/components/today-tab"
import { qualityPeriodSchema } from "@/features/team-cabinet/schemas"
import { tryLoad } from "@/lib/api/load"
import { formatTime } from "@/lib/format"
import { getParam, hrefWithParams, type SearchParamsRecord } from "@/lib/search-params"

const TABS = [
  { value: "today", label: "Сегодня" },
  { value: "plan", label: "План — факт" },
  { value: "quality", label: "Встречи и звонки" },
  { value: "funnel", label: "Воронка" },
] as const

type Tab = (typeof TABS)[number]["value"]

/**
 * «Кабинет РОПа» — только чтение: ни одной кнопки, меняющей данные сделок (ТЗ, п. 4.1).
 * Загружаются данные только открытой вкладки.
 */
export async function CabinetView({ params }: { params: SearchParamsRecord }) {
  const tabParam = getParam(params, "tab")
  const tab: Tab = TABS.find((item) => item.value === tabParam)?.value ?? "today"
  const periodResult = qualityPeriodSchema.safeParse(getParam(params, "period"))
  const period = periodResult.success ? periodResult.data : "week"
  const href = (patch: Record<string, string | null>) => hrefWithParams(routes.team, params, patch)

  const today = await tryLoad(() => teamCabinetRepository.getToday())
  if (!today.ok) return <ApiErrorState error={today.error} />
  const { asOf, workDay } = today.data

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Кабинет РОПа</h1>
          <p className="text-meta text-muted-foreground">
            {workDay.monthLabel} · рабочий день {workDay.number} из {workDay.total} · данные на {formatTime(asOf)}
          </p>
        </div>
        <Button variant="outline" disabled title="Снимок для планёрки и отправка в Telegram появятся после подключения интеграции">
          <CameraOff data-icon="inline-start" aria-hidden />
          Срез на планёрку
        </Button>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b">
        <SegmentedLinks
          label="Разделы кабинета"
          items={TABS.map((item) => ({ key: item.value, label: item.label, href: href({ tab: item.value === "today" ? null : item.value }), isActive: item.value === tab }))}
        />
        {tab === "quality" && (
          <SegmentedLinks
            label="Период"
            variant="pill"
            className="mb-1.5"
            items={[
              { key: "week", label: "7 дней", href: href({ period: null }), isActive: period === "week" },
              { key: "month", label: "Месяц", href: href({ period: "month" }), isActive: period === "month" },
            ]}
          />
        )}
      </div>

      {tab === "today" && <TodayTab data={today.data} />}
      {tab === "plan" && <PlanFactTab data={today.data} />}
      {tab === "quality" && <QualitySection period={period} />}
      {tab === "funnel" && <FunnelSection />}
    </div>
  )
}

async function QualitySection({ period }: { period: "week" | "month" }) {
  const result = await tryLoad(() => teamCabinetRepository.getQuality(period))
  return result.ok ? <QualityTab data={result.data} /> : <ApiErrorState error={result.error} />
}

async function FunnelSection() {
  const result = await tryLoad(() => teamCabinetRepository.getFunnel())
  return result.ok ? <FunnelTab data={result.data} /> : <ApiErrorState error={result.error} />
}

export function CabinetViewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-9 w-[28rem] max-w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
