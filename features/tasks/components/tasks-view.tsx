import { ApiErrorState } from "@/components/shared/api-error-state"
import { FilterSelect } from "@/components/shared/filter-select"
import { SearchInput } from "@/components/shared/search-input"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { Toolbar } from "@/components/shared/toolbar"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { teamRepository } from "@/features/team"
import { tasksRepository, UNASSIGNED, type TasksQuery } from "@/features/tasks/api/tasks-repository"
import { TasksList } from "@/features/tasks/components/tasks-list"
import { tryLoad } from "@/lib/api/load"
import { pageParams } from "@/lib/api/pagination"
import { editModeFor } from "@/lib/permissions/edit-mode"
import { hasPermission } from "@/lib/permissions/roles"
import { getParam, hrefWithParams, type SearchParamsRecord } from "@/lib/search-params"
import type { CurrentUser } from "@/lib/session/current-user"

/** Задачи показываем одним списком с группами по сроку; 200 — максимум limit у backend */
const TASKS_LIMIT = 200

const STATUS_TABS: readonly { value: TasksQuery["status"]; label: string }[] = [
  { value: "open", label: "Открытые" },
  { value: "done", label: "Выполненные" },
  { value: "all", label: "Все" },
]

const DUE_FILTERS = [
  { value: "overdue", label: "Просроченные" },
  { value: "today", label: "На сегодня" },
  { value: "no_due", label: "Без срока" },
] as const

type TasksViewProps = {
  user: CurrentUser
  params: SearchParamsRecord
}

export async function TasksView({ user, params }: TasksViewProps) {
  const isTeamView = hasPermission(user.role, "team.view")
  const statusParam = getParam(params, "status")
  const status = STATUS_TABS.find((tab) => tab.value === statusParam)?.value ?? "open"
  const assigneeParam = getParam(params, "assignee")
  // Менеджер видит свои задачи и «ничьи», которые можно взять; руководитель — всех
  const assigneeId = isTeamView ? assigneeParam : assigneeParam === UNASSIGNED ? UNASSIGNED : user.id
  const href = (patch: Record<string, string | null>) => hrefWithParams(routes.tasks, params, patch)

  const loaded = await tryLoad(() =>
    Promise.all([
      tasksRepository.listTasks({
        status,
        assigneeId,
        leadId: null,
        search: isMockDataSource ? getParam(params, "q") : null,
        due: DUE_FILTERS.find((item) => item.value === getParam(params, "due"))?.value ?? null,
        important: getParam(params, "priority") === "high",
        ...pageParams(1, TASKS_LIMIT),
      }),
      isTeamView ? teamRepository.listMembers() : Promise.resolve([]),
    ])
  )
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const [result, members] = loaded.data

  return (
    <div className="space-y-3">
      <Toolbar>
        <SegmentedLinks
          label="Статус задач"
          variant="pill"
          items={STATUS_TABS.map((tab) => ({
            key: tab.value,
            label: tab.label,
            href: href({ status: tab.value === "open" ? null : tab.value }),
            isActive: tab.value === status,
          }))}
        />
        {/* Поиска по задачам у backend нет: поле только в демо-режиме */}
        {isMockDataSource && <SearchInput label="Поиск задач" placeholder="Задача или клиент" className="w-full sm:w-64" />}
        <FilterSelect label="Срок" param="due" allLabel="Любой срок" options={DUE_FILTERS.map((item) => ({ ...item }))} />
        <FilterSelect label="Приоритет" param="priority" allLabel="Любой приоритет" options={[{ value: "high", label: "Важные" }]} />
        {isTeamView ? (
          <FilterSelect
            label="Исполнитель"
            param="assignee"
            allLabel="Все исполнители"
            options={[
              { value: UNASSIGNED, label: "Без исполнителя" },
              ...members.map((member) => ({ value: member.id, label: member.name })),
            ]}
          />
        ) : (
          <SegmentedLinks
            label="Чьи задачи"
            variant="pill"
            items={[
              { key: "mine", label: "Мои", href: href({ assignee: null }), isActive: assigneeId !== UNASSIGNED },
              { key: "none", label: "Без исполнителя", href: href({ assignee: UNASSIGNED }), isActive: assigneeId === UNASSIGNED },
            ]}
          />
        )}
      </Toolbar>

      <TasksList
        key={JSON.stringify([status, assigneeId, getParam(params, "q"), getParam(params, "due"), getParam(params, "priority")])}
        initialTasks={result.results}
        members={members}
        currentUser={{ id: user.id, name: user.fullName }}
        canAssign={hasPermission(user.role, "records.assign")}
        editMode={editModeFor(user.role)}
        showAssignee={isTeamView}
        lead={null}
        emptyTitle={status === "done" ? "Выполненных задач нет" : "Задач нет"}
        emptyDescription="Измените фильтры или создайте задачу, чтобы не потерять следующий шаг по клиенту."
      />
    </div>
  )
}

export function TasksViewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-9 w-80" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
