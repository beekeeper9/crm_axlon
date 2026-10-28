import { Columns3, Rows3, Workflow } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterSelect } from "@/components/shared/filter-select"
import { SearchInput } from "@/components/shared/search-input"
import { ListPanel } from "@/components/shared/list-panel"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { Toolbar } from "@/components/shared/toolbar"
import { Skeleton } from "@/components/ui/skeleton"
import { routes } from "@/config/routes"
import {
  DEAL_SORTS,
  salesRepository,
  type DealSort,
  type DealsFilter,
  type DealsListQuery,
} from "@/features/sales/api/sales-repository"
import { DealsTable } from "@/features/sales/components/deals-table"
import { PipelineBoard } from "@/features/sales/components/pipeline-board"
import type { Pipeline } from "@/features/sales/schemas"
import { teamRepository } from "@/features/team"
import { tryLoad } from "@/lib/api/load"
import { pageInfo, pageParams } from "@/lib/api/pagination"
import { editModeFor } from "@/lib/permissions/edit-mode"
import { hasPermission } from "@/lib/permissions/roles"
import { getPageParam, getParam, hrefWithParams, type ParamPatch, type SearchParamsRecord } from "@/lib/search-params"
import type { CurrentUser } from "@/lib/session/current-user"

/** Размер страницы таблицы (backend допускает limit от 1 до 200) */
const TABLE_PAGE_SIZE = 20

type SalesViewProps = {
  user: CurrentUser
  params: SearchParamsRecord
}

export async function SalesView({ user, params }: SalesViewProps) {
  const isTeamView = hasPermission(user.role, "team.view")
  const loaded = await tryLoad(() =>
    Promise.all([salesRepository.getConfig(), isTeamView ? teamRepository.listMembers() : Promise.resolve([])])
  )
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const [config, members] = loaded.data

  if (config.pipelines.length === 0) {
    return (
      <ListPanel>
        <EmptyState
          icon={Workflow}
          title="Воронки ещё не настроены"
          description="Воронки и этапы задаёт руководитель в настройках компании."
        />
      </ListPanel>
    )
  }

  const pipeline = config.pipelines.find((item) => item.id === getParam(params, "pipeline")) ?? config.pipelines[0]
  const view = getParam(params, "view") === "table" ? "table" : "board"
  // Менеджер работает со своими сделками; фильтр по сотрудникам — у руководителя
  const managerId = isTeamView ? getParam(params, "manager") : user.id
  const filter = { pipelineId: pipeline.id, managerId, search: getParam(params, "q") }
  const href = (patch: ParamPatch) => hrefWithParams(routes.sales, params, patch)

  return (
    <div className="space-y-3">
      <Toolbar
        end={
          <SegmentedLinks
            label="Вид"
            variant="pill"
            iconOnly
            items={[
              { key: "board", label: "Доска", icon: Columns3, href: href({ view: null, sort: null }), isActive: view === "board" },
              { key: "table", label: "Таблица", icon: Rows3, href: href({ view: "table" }), isActive: view === "table" },
            ]}
          />
        }
      >
        {config.pipelines.length > 1 && (
          <SegmentedLinks
            label="Воронки"
            variant="pill"
            items={config.pipelines.map((item) => ({
              key: item.id,
              label: item.name,
              href: href({ pipeline: item.id, stage: null }),
              isActive: item.id === pipeline.id,
            }))}
          />
        )}
        <SearchInput label="Поиск сделок" placeholder="Имя, телефон или метка" className="w-full sm:w-64" />
        {isTeamView && (
          <FilterSelect
            label="Ответственный"
            param="manager"
            allLabel="Все сотрудники"
            options={members.map((member) => ({ value: member.id, label: member.name }))}
          />
        )}
        {view === "table" && (
          <FilterSelect
            label="Этап"
            param="stage"
            allLabel="Все этапы"
            options={pipeline.stages.map((stage) => ({ value: stage.id, label: stage.name }))}
          />
        )}
      </Toolbar>

      {view === "board" ? (
        <BoardSection
          filter={filter}
          pipeline={pipeline}
          lossReasons={config.lossReasons}
          showManager={isTeamView}
          editMode={editModeFor(user.role)}
        />
      ) : (
        <TableSection
          query={{
            ...filter,
            stageId: getParam(params, "stage"),
            attention: null,
            sort: parseDealSort(getParam(params, "sort")),
            ...pageParams(getPageParam(params), TABLE_PAGE_SIZE),
          }}
          pipelines={[pipeline]}
          showManager={isTeamView}
          hrefFor={href}
        />
      )}
    </div>
  )
}

async function BoardSection({
  filter,
  ...props
}: { filter: DealsFilter } & Omit<React.ComponentProps<typeof PipelineBoard>, "board">) {
  const result = await tryLoad(() => salesRepository.getBoard(filter))
  if (!result.ok) return <ApiErrorState error={result.error} />
  // key: при смене фильтров локальное состояние доски начинается с новых данных
  return <PipelineBoard key={JSON.stringify(filter)} board={result.data} {...props} />
}

type TableSectionProps = {
  query: DealsListQuery
  pipelines: readonly Pipeline[]
  showManager: boolean
  hrefFor: (patch: ParamPatch) => string
}

/** Таблица сделок — общая для «Продаж» и «Списка» */
export async function TableSection({ query, pipelines, showManager, hrefFor }: TableSectionProps) {
  const result = await tryLoad(() => salesRepository.listDeals(query))
  if (!result.ok) return <ApiErrorState error={result.error} />
  return (
    <DealsTable
      deals={result.data.results}
      pipelines={pipelines}
      showPipeline={query.pipelineId === null}
      showManager={showManager}
      pageInfo={pageInfo(result.data.count, query)}
      sort={query.sort}
      hrefFor={hrefFor}
      emptyDescription="Измените поиск или фильтры — например, выберите другой этап или сотрудника."
    />
  )
}

export function parseDealSort(value: string | null): DealSort {
  return DEAL_SORTS.find((sort) => sort === value) ?? "-updated"
}

export function SalesViewSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="ml-auto h-8 w-16" />
      </div>
      <Skeleton className="h-4 w-56" />
      <div className="flex gap-2.5 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-96 w-[17rem] shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
