import { ApiErrorState } from "@/components/shared/api-error-state"
import { FilterSelect } from "@/components/shared/filter-select"
import { SearchInput } from "@/components/shared/search-input"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { Toolbar } from "@/components/shared/toolbar"
import { routes } from "@/config/routes"
import { salesRepository, type DealAttention } from "@/features/sales/api/sales-repository"
import { parseDealSort, TableSection } from "@/features/sales/components/sales-view"
import { teamRepository } from "@/features/team"
import { tryLoad } from "@/lib/api/load"
import { pageParams } from "@/lib/api/pagination"
import { hasPermission } from "@/lib/permissions/roles"
import { getPageParam, getParam, hrefWithParams, type ParamPatch, type SearchParamsRecord } from "@/lib/search-params"
import type { CurrentUser } from "@/lib/session/current-user"

/** В «Списке» строк больше, чем в таблице воронки: это основной экран поиска */
const LIST_PAGE_SIZE = 25

const ATTENTION_FILTERS: readonly { value: DealAttention | null; label: string }[] = [
  { value: null, label: "Все" },
  { value: "overdue", label: "Шаг просрочен" },
  { value: "no_next_step", label: "Без следующего шага" },
]

type LeadsListViewProps = {
  user: CurrentUser
  params: SearchParamsRecord
}

/** «Список»: все лиды по всем воронкам — найти, отфильтровать, сравнить и открыть карточку */
export async function LeadsListView({ user, params }: LeadsListViewProps) {
  const isTeamView = hasPermission(user.role, "team.view")
  const loaded = await tryLoad(() =>
    Promise.all([salesRepository.getConfig(), isTeamView ? teamRepository.listMembers() : Promise.resolve([])])
  )
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const [config, members] = loaded.data

  const pipeline = config.pipelines.find((item) => item.id === getParam(params, "pipeline")) ?? null
  const attentionParam = getParam(params, "attention")
  const attention = ATTENTION_FILTERS.find((item) => item.value === attentionParam)?.value ?? null
  const href = (patch: ParamPatch) => hrefWithParams(routes.leads, params, patch)

  return (
    <div className="space-y-3">
      <Toolbar>
        <SearchInput label="Поиск лидов" placeholder="Имя, телефон или метка" className="w-full sm:w-72" />
        <SegmentedLinks
          label="Требует внимания"
          variant="pill"
          items={ATTENTION_FILTERS.map((item) => ({
            key: item.value ?? "all",
            label: item.label,
            href: href({ attention: item.value }),
            isActive: item.value === attention,
          }))}
        />
        <FilterSelect
          label="Воронка"
          param="pipeline"
          allLabel="Все воронки"
          options={config.pipelines.map((item) => ({ value: item.id, label: item.name }))}
        />
        {pipeline && (
          <FilterSelect
            label="Этап"
            param="stage"
            allLabel="Все этапы"
            options={pipeline.stages.map((stage) => ({ value: stage.id, label: stage.name }))}
          />
        )}
        {isTeamView && (
          <FilterSelect
            label="Ответственный"
            param="manager"
            allLabel="Все сотрудники"
            options={members.map((member) => ({ value: member.id, label: member.name }))}
          />
        )}
      </Toolbar>

      <TableSection
        query={{
          pipelineId: pipeline?.id ?? null,
          stageId: pipeline ? getParam(params, "stage") : null,
          managerId: isTeamView ? getParam(params, "manager") : user.id,
          search: getParam(params, "q"),
          attention,
          sort: parseDealSort(getParam(params, "sort")),
          ...pageParams(getPageParam(params), LIST_PAGE_SIZE),
        }}
        pipelines={config.pipelines}
        showManager={isTeamView}
        hrefFor={href}
      />
    </div>
  )
}
