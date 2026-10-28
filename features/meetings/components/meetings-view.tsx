import Link from "next/link"
import { ClipboardList, X } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { FilterSelect } from "@/components/shared/filter-select"
import { SearchInput } from "@/components/shared/search-input"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { Toolbar } from "@/components/shared/toolbar"
import { Skeleton } from "@/components/ui/skeleton"
import { routes } from "@/config/routes"
import { meetingsRepository } from "@/features/meetings/api/meetings-repository"
import { MeetingsList } from "@/features/meetings/components/meetings-list"
import { MEETING_PERIODS, MEETING_STATUS_META } from "@/features/meetings/lib/meeting-meta"
import { meetingStatusSchema } from "@/features/meetings/schemas"
import { teamRepository } from "@/features/team"
import { tryLoad } from "@/lib/api/load"
import { PAGE_LIMIT_MAX } from "@/lib/api/pagination"
import { formatNumber, pluralize } from "@/lib/format"
import { editModeFor } from "@/lib/permissions/edit-mode"
import { hasPermission } from "@/lib/permissions/roles"
import { getParam, hrefWithParams, type SearchParamsRecord } from "@/lib/search-params"
import type { CurrentUser } from "@/lib/session/current-user"

type Person = { id: string; name: string }

type MeetingsViewProps = {
  user: CurrentUser
  params: SearchParamsRecord
  /** Клиенты для формы новой встречи (собирает страница из модуля лидов) */
  leadOptions: readonly Person[]
}

export async function MeetingsView({ user, params, leadOptions }: MeetingsViewProps) {
  const isTeamView = hasPermission(user.role, "team.view")
  const onlyOutcome = getParam(params, "outcome") === "required"
  const periodParam = getParam(params, "period")
  const period = MEETING_PERIODS.find((item) => item.value === periodParam)?.value ?? "today"
  const statusResult = meetingStatusSchema.safeParse(getParam(params, "status"))
  const hostId = isTeamView ? getParam(params, "host") : user.id
  const href = (patch: Record<string, string | null>) => hrefWithParams(routes.meetings, params, patch)

  const common = { hostId, leadId: null, limit: PAGE_LIMIT_MAX, offset: 0 }
  const loaded = await tryLoad(() =>
    Promise.all([
      meetingsRepository.listMeetings({
        ...common,
        period: onlyOutcome ? null : period,
        status: statusResult.success ? statusResult.data : null,
        search: getParam(params, "q"),
        outcomeRequired: onlyOutcome,
      }),
      meetingsRepository.listMeetings({ ...common, period: null, status: null, search: null, outcomeRequired: true, limit: 1 }),
      isTeamView ? teamRepository.listMembers() : Promise.resolve([]),
    ])
  )
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const [result, pendingOutcome, members] = loaded.data

  return (
    <div className="space-y-3">
      {pendingOutcome.count > 0 && !onlyOutcome && (
        <Link
          href={href({ outcome: "required", period: null, status: null })}
          className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/8 px-3 py-2 text-sm transition-colors hover:bg-warning/12"
        >
          <ClipboardList className="size-4 text-warning" aria-hidden />
          <span>
            <strong className="font-semibold text-warning">{formatNumber(pendingOutcome.count)}</strong>{" "}
            {pluralize(pendingOutcome.count, ["встреча", "встречи", "встреч"])} без итога — запишите, как прошло
          </span>
        </Link>
      )}

      <Toolbar>
        {onlyOutcome ? (
          <span className="flex h-8 items-center gap-1 rounded-lg bg-muted px-2.5 text-sm font-medium">
            Без итога
            <Link
              href={href({ outcome: null })}
              aria-label="Сбросить фильтр «Без итога»"
              className="-mr-1 flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </Link>
          </span>
        ) : (
          <SegmentedLinks
            label="Период"
            variant="pill"
            items={MEETING_PERIODS.map((item) => ({
              key: item.value,
              label: item.label,
              href: href({ period: item.value === "today" ? null : item.value }),
              isActive: item.value === period,
            }))}
          />
        )}
        <SearchInput label="Поиск встреч" placeholder="Клиент или заметка" className="w-full sm:w-64" />
        <FilterSelect
          label="Статус"
          param="status"
          allLabel="Все статусы"
          options={meetingStatusSchema.options.map((status) => ({ value: status, label: MEETING_STATUS_META[status].label }))}
        />
        {isTeamView && (
          <FilterSelect
            label="Проводит"
            param="host"
            allLabel="Все сотрудники"
            options={members.map((member) => ({ value: member.id, label: member.name }))}
          />
        )}
      </Toolbar>

      <MeetingsList
        key={JSON.stringify([period, onlyOutcome, statusResult.data, hostId, getParam(params, "q")])}
        initialMeetings={result.results}
        editMode={editModeFor(user.role)}
        showPeople={isTeamView}
        lead={null}
        leadOptions={leadOptions}
        hosts={isTeamView ? members : []}
        currentUser={{ id: user.id, name: user.fullName }}
        emptyTitle={onlyOutcome ? "Все итоги записаны" : "Встреч нет"}
        emptyDescription={onlyOutcome ? "По прошедшим встречам итоги заполнены." : "Выберите другой период или назначьте встречу клиенту."}
      />
    </div>
  )
}

export function MeetingsViewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-9 w-80" />
      <Skeleton className="h-8 w-96" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  )
}
