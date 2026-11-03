import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { Skeleton } from "@/components/ui/skeleton"
import { routes } from "@/config/routes"
import { CreateFunnelForm } from "@/features/sales/funnel/create-funnel-form"
import { getFunnelWithCounts, listDepartments, listFunnels, type Funnel } from "@/features/sales/funnel/funnel-api"
import { FunnelEditor } from "@/features/sales/funnel/funnel-editor"
import { activeStages } from "@/features/sales/funnel/funnel-rules"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { getParam, type SearchParamsRecord } from "@/lib/search-params"

/** Адрес настройки воронки */
export const FUNNEL_SETTINGS_PATH = `${routes.sales}/funnel`

/**
 * Настройка воронки продаж. РОП видит и меняет воронки своего отдела (их же видят его
 * менеджеры на «Продажах»); директор — воронки любого отдела и компании.
 */
export async function FunnelSettingsView({ params, isDirector }: { params: SearchParamsRecord; isDirector: boolean }) {
  const auth = await getRenderAuth()
  const loaded = await tryLoad(() => Promise.all([listFunnels(auth), isDirector ? listDepartments(auth) : Promise.resolve(null)]))
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const [funnels, departments] = loaded.data
  // РОПу backend показывает только воронки его отдела и компании; менять он может свои
  const editable = isDirector ? funnels : funnels.filter((funnel) => funnel.departmentId !== null)
  const departmentName = new Map((departments ?? []).map((department) => [department.id, department.name]))
  const companyDefault = funnels.find((funnel) => funnel.departmentId === null && funnel.isDefault)
  const companyStages = companyDefault ? activeStages(companyDefault.stages).map(({ name, kind }) => ({ name, kind })) : []
  const selectedId = getParam(params, "pipeline")
  const isCreating = getParam(params, "new") === "1" || editable.length === 0
  const selected = isCreating ? null : (editable.find((funnel) => funnel.id === selectedId) ?? editable[0])
  const label = (funnel: Funnel) =>
    funnel.departmentId === null ? `${funnel.name} · компания` : isDirector ? `${funnel.name} · ${departmentName.get(funnel.departmentId) ?? "отдел"}` : funnel.name

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={routes.sales} className="inline-flex items-center gap-1 text-meta text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden />
        Продажи
      </Link>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Воронка продаж</h1>
        <p className="text-sm text-muted-foreground">
          {isDirector
            ? "Этапы воронок отделов и компании. Менеджеры отдела работают в воронке своего отдела."
            : "Этапы воронки вашего отдела. Менеджеры отдела сразу видят изменения у себя на «Продажах»."}
        </p>
      </div>

      {editable.length > 0 && (
        <SegmentedLinks
          label="Воронки"
          variant="pill"
          items={[
            ...editable.map((funnel) => ({
              key: funnel.id,
              label: label(funnel),
              href: `${FUNNEL_SETTINGS_PATH}?pipeline=${encodeURIComponent(funnel.id)}`,
              isActive: funnel.id === selected?.id,
            })),
            { key: "new", label: "+ Новая воронка", href: `${FUNNEL_SETTINGS_PATH}?new=1`, isActive: isCreating },
          ]}
        />
      )}

      {isCreating ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{editable.length === 0 ? "У отдела пока нет своей воронки" : "Новая воронка"}</h2>
          <p className="text-meta text-muted-foreground">
            {editable.length === 0 && !isDirector
              ? "Сейчас менеджеры отдела работают в общей воронке компании. Создайте воронку отдела — новые сделки менеджеров будут попадать в неё."
              : "Первая воронка отдела становится для него основной."}
          </p>
          <CreateFunnelForm companyStages={companyStages} departments={isDirector ? (departments ?? []) : null} basePath={FUNNEL_SETTINGS_PATH} />
        </section>
      ) : selected ? (
        <SelectedFunnel id={selected.id} />
      ) : null}
    </div>
  )
}

async function SelectedFunnel({ id }: { id: string }) {
  const loaded = await tryLoad(async () => getFunnelWithCounts(await getRenderAuth(), id))
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  return <FunnelEditor key={id} funnel={loaded.data} />
}

export function FunnelSettingsSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  )
}
