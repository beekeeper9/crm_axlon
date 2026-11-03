import Link from "next/link"
import { Inbox } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterSelect } from "@/components/shared/filter-select"
import { ListPanel } from "@/components/shared/list-panel"
import { PaginationNav } from "@/components/shared/pagination-nav"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { SearchInput } from "@/components/shared/search-input"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { StatusBadge } from "@/components/shared/status-badge"
import { Toolbar } from "@/components/shared/toolbar"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { prospectRoute, routes } from "@/config/routes"
import { prospectsRepository } from "@/features/prospects/api/prospects-repository"
import { NewProspectButton } from "@/features/prospects/components/new-prospect-button"
import { PROSPECT_SOURCE_LABELS, PROSPECT_STATUS_META } from "@/features/prospects/lib/prospect-meta"
import { prospectSourceSchema, prospectStatusSchema, type ProspectSource } from "@/features/prospects/schemas"
import { fetchReferenceList } from "@/features/reference-lists"
import { teamRepository } from "@/features/team"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { pageInfo, pageParams } from "@/lib/api/pagination"
import { formatDayMonth } from "@/lib/format"
import { hasPermission } from "@/lib/permissions/roles"
import { getPageParam, getParam, hrefWithParams, type ParamPatch, type SearchParamsRecord } from "@/lib/search-params"
import type { CurrentUser } from "@/lib/session/current-user"

const PAGE_SIZE = 25

/** Включённые источники с подписями компании; справочник недоступен — стандартный набор */
async function leadSources(): Promise<{ value: ProspectSource; label: string }[]> {
  try {
    const items = await fetchReferenceList(await getRenderAuth(), "lead_source", true)
    return items.flatMap((item) => {
      const code = prospectSourceSchema.safeParse(item.ref)
      return code.success ? [{ value: code.data, label: item.label }] : []
    })
  } catch {
    return []
  }
}

const STATUS_FILTERS = [null, ...prospectStatusSchema.options] as const

type ProspectsViewProps = {
  user: CurrentUser
  params: SearchParamsRecord
}

/** Входящие лиды: заявки до клиента и сделки. Видимость (свои, отдел, компания) решает backend */
export async function ProspectsView({ user, params }: ProspectsViewProps) {
  const isTeamView = hasPermission(user.role, "team.view")
  const status = prospectStatusSchema.safeParse(getParam(params, "status")).data ?? null
  const source = prospectSourceSchema.safeParse(getParam(params, "source")).data ?? null
  const paging = pageParams(getPageParam(params), PAGE_SIZE)
  const href = (patch: ParamPatch) => hrefWithParams(routes.prospects, params, patch)

  const loaded = await tryLoad(() =>
    Promise.all([
      prospectsRepository.listProspects({
        search: getParam(params, "q"),
        status,
        source,
        ownerId: isTeamView ? getParam(params, "owner") : null,
        ...paging,
      }),
      isTeamView ? teamRepository.listMembers() : Promise.resolve([]),
    ])
  )
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const [result, members] = loaded.data
  const isFiltered = Boolean(getParam(params, "q") || status || source || getParam(params, "owner"))

  return (
    <div className="space-y-3">
      <Toolbar>
        <SearchInput label="Поиск лидов" placeholder="Имя, телефон или e-mail" className="w-full sm:w-72" />
        <SegmentedLinks
          label="Статус лида"
          variant="pill"
          items={STATUS_FILTERS.map((value) => ({
            key: value ?? "all",
            label: value ? PROSPECT_STATUS_META[value].label : "Все",
            href: href({ status: value, page: null }),
            isActive: value === status,
          }))}
        />
        <FilterSelect
          label="Источник"
          param="source"
          allLabel="Все источники"
          options={prospectSourceSchema.options.map((value) => ({ value, label: PROSPECT_SOURCE_LABELS[value] }))}
        />
        {isTeamView && (
          <FilterSelect
            label="Ответственный"
            param="owner"
            allLabel="Все сотрудники"
            options={members.map((member) => ({ value: member.id, label: member.name }))}
          />
        )}
        {!isMockDataSource && hasPermission(user.role, "records.edit") && <NewProspectButton sources={await leadSources()} />}
      </Toolbar>

      {result.results.length === 0 ? (
        <ListPanel>
          <EmptyState
            icon={Inbox}
            title={isFiltered ? "Никого не нашли" : "Входящих лидов нет"}
            description={
              isFiltered
                ? "Измените фильтры или введите больше цифр номера."
                : "Здесь появляются заявки с сайта, мессенджеров и звонков — до того, как человек стал клиентом."
            }
          />
        </ListPanel>
      ) : (
        <ListPanel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="text-left text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
                <tr>
                  <th scope="col" className="h-9 px-3 font-medium">Лид</th>
                  <th scope="col" className="h-9 px-3 font-medium">Источник</th>
                  <th scope="col" className="h-9 px-3 font-medium">Статус</th>
                  {isTeamView && <th scope="col" className="h-9 px-3 font-medium">Ответственный</th>}
                  <th scope="col" className="h-9 px-3 text-right font-medium">Создан</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.results.map((prospect) => (
                  <tr key={prospect.id} className="relative transition-colors hover:bg-accent/50 focus-within:bg-accent/50">
                    <td className="px-3 py-2">
                      <Link href={prospectRoute(prospect.id)} className="font-medium after:absolute after:inset-0 focus-visible:outline-none">
                        {prospect.name}
                      </Link>
                      <p className="text-meta text-muted-foreground tabular-nums">
                        {[prospect.phone, prospect.email].filter(Boolean).join(" · ") || "Контакты не указаны"}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-meta">{PROSPECT_SOURCE_LABELS[prospect.source]}</td>
                    <td className="px-3 py-2">
                      <StatusBadge tone={PROSPECT_STATUS_META[prospect.status].tone}>{PROSPECT_STATUS_META[prospect.status].label}</StatusBadge>
                    </td>
                    {isTeamView && (
                      <td className="px-3 py-2 text-meta whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <PersonAvatar name={prospect.owner.name} />
                          {prospect.owner.name}
                        </span>
                      </td>
                    )}
                    <td className="px-3 py-2 text-right text-meta text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatDayMonth(prospect.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListPanel>
      )}
      <PaginationNav info={pageInfo(result.count, paging)} hrefForPage={(page) => href({ page: page > 1 ? String(page) : null })} />
    </div>
  )
}

export function ProspectsViewSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-8 w-96 max-w-full" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  )
}
