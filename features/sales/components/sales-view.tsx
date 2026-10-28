import { Columns3, Rows3, Workflow } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { FilterSelect } from "@/components/shared/filter-select"
import { SearchInput } from "@/components/shared/search-input"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { routes } from "@/config/routes"
import { salesRepository, type DealsFilter } from "@/features/sales/api/sales-repository"
import { DealsTable } from "@/features/sales/components/deals-table"
import { PipelineBoard } from "@/features/sales/components/pipeline-board"
import type { Pipeline } from "@/features/sales/schemas"
import { teamRepository } from "@/features/team"
import { pageInfo, pageParams } from "@/lib/api/pagination"
import { editModeFor } from "@/lib/permissions/edit-mode"
import { hasPermission } from "@/lib/permissions/roles"
import { getPageParam, getParam, hrefWithParams, type SearchParamsRecord } from "@/lib/search-params"
import type { CurrentUser } from "@/lib/session/current-user"

/** Размер страницы таблицы (backend допускает limit от 1 до 200) */
const TABLE_PAGE_SIZE = 20

type SalesViewProps = {
  user: CurrentUser
  params: SearchParamsRecord
}

export async function SalesView({ user, params }: SalesViewProps) {
  const isTeamView = hasPermission(user.role, "team.view")
  const [config, members] = await Promise.all([
    salesRepository.getConfig(),
    isTeamView ? teamRepository.listMembers() : Promise.resolve([]),
  ])

  if (config.pipelines.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Workflow}
          title="Воронки ещё не настроены"
          description="Воронки и этапы задаёт руководитель в настройках компании."
        />
      </Card>
    )
  }

  const pipeline = config.pipelines.find((item) => item.id === getParam(params, "pipeline")) ?? config.pipelines[0]
  const view = getParam(params, "view") === "table" ? "table" : "board"
  // Менеджер работает со своими сделками; фильтр по сотрудникам — у руководителя
  const managerId = isTeamView ? getParam(params, "manager") : user.id
  const filter = { pipelineId: pipeline.id, managerId, search: getParam(params, "q") }
  const href = (patch: Record<string, string | null>) => hrefWithParams(routes.sales, params, patch)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b">
        <SegmentedLinks
          label="Воронки"
          items={config.pipelines.map((item) => ({
            key: item.id,
            label: item.name,
            href: href({ pipeline: item.id, stage: null }),
            isActive: item.id === pipeline.id,
          }))}
        />
        <SegmentedLinks
          label="Вид"
          variant="pill"
          iconOnly
          className="mb-1.5"
          items={[
            { key: "board", label: "Доска", icon: Columns3, href: href({ view: null }), isActive: view === "board" },
            { key: "table", label: "Таблица", icon: Rows3, href: href({ view: "table" }), isActive: view === "table" },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput label="Поиск сделок" placeholder="Имя, телефон или метка" className="w-full sm:w-72" />
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
      </div>

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
          filter={filter}
          stageId={getParam(params, "stage")}
          page={getPageParam(params)}
          pipeline={pipeline}
          showManager={isTeamView}
          hrefForPage={(page) => href({ page: page > 1 ? String(page) : null })}
        />
      )}
    </div>
  )
}

async function BoardSection({
  filter,
  ...props
}: { filter: DealsFilter } & Omit<React.ComponentProps<typeof PipelineBoard>, "board">) {
  const board = await salesRepository.getBoard(filter)
  // key: при смене фильтров локальное состояние доски начинается с новых данных
  return <PipelineBoard key={JSON.stringify(filter)} board={board} {...props} />
}

type TableSectionProps = {
  filter: DealsFilter
  stageId: string | null
  page: number
  pipeline: Pipeline
  showManager: boolean
  hrefForPage: (page: number) => string
}

async function TableSection({ filter, stageId, page, pipeline, showManager, hrefForPage }: TableSectionProps) {
  const paging = pageParams(page, TABLE_PAGE_SIZE)
  const result = await salesRepository.listDeals({ ...filter, stageId, ...paging })
  return (
    <DealsTable
      deals={result.results}
      pipeline={pipeline}
      showManager={showManager}
      pageInfo={pageInfo(result.count, paging)}
      hrefForPage={hrefForPage}
    />
  )
}

export function SalesViewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="flex gap-2 border-b pb-2">
        {[96, 120, 128].map((width) => (
          <Skeleton key={width} className="h-7" style={{ width }} />
        ))}
      </div>
      <Skeleton className="h-8 w-72" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-96 w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
