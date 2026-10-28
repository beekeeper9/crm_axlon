import { ApiErrorState } from "@/components/shared/api-error-state"
import { FilterSelect } from "@/components/shared/filter-select"
import { Toolbar } from "@/components/shared/toolbar"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { afterMeetingRepository } from "@/features/after-meeting/api/after-meeting-repository"
import { AfterMeetingWorkspace } from "@/features/after-meeting/components/after-meeting-workspace"
import { teamRepository } from "@/features/team"
import { tryLoad } from "@/lib/api/load"
import { editModeFor } from "@/lib/permissions/edit-mode"
import { hasPermission } from "@/lib/permissions/roles"
import { getParam, type SearchParamsRecord } from "@/lib/search-params"
import type { CurrentUser } from "@/lib/session/current-user"

type AfterMeetingViewProps = {
  user: CurrentUser
  params: SearchParamsRecord
}

export async function AfterMeetingView({ user, params }: AfterMeetingViewProps) {
  const isTeamView = hasPermission(user.role, "team.view")
  const hostId = isTeamView ? getParam(params, "host") : user.id
  const loaded = await tryLoad(() =>
    Promise.all([
      afterMeetingRepository.getQueue({ hostId }),
      isTeamView ? teamRepository.listMembers() : Promise.resolve([]),
    ])
  )
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const [queue, members] = loaded.data

  return (
    <div className="space-y-3">
      {isTeamView && (
        <Toolbar>
          <FilterSelect
            label="Проводил встречу"
            param="host"
            allLabel="Все сотрудники"
            options={members.map((member) => ({ value: member.id, label: member.name }))}
          />
        </Toolbar>
      )}
      <AfterMeetingWorkspace
        key={hostId ?? "all"}
        queue={queue}
        editMode={editModeFor(user.role)}
        showHost={isTeamView}
        isDemoData={isMockDataSource}
      />
    </div>
  )
}

export function AfterMeetingViewSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]" aria-busy="true">
      <Skeleton className="h-96 rounded-xl" />
      <Skeleton className="h-96 rounded-xl max-lg:hidden" />
    </div>
  )
}
