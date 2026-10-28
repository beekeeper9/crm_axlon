import Link from "next/link"
import { Users } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterSelect } from "@/components/shared/filter-select"
import { ListPanel } from "@/components/shared/list-panel"
import { PaginationNav } from "@/components/shared/pagination-nav"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { SearchInput } from "@/components/shared/search-input"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { Toolbar } from "@/components/shared/toolbar"
import { UrlSheet } from "@/components/shared/url-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { routes } from "@/config/routes"
import { clientsRepository, type ClientStatus } from "@/features/clients/api/clients-repository"
import { ClientDetailContent } from "@/features/clients/components/client-detail"
import { teamRepository } from "@/features/team"
import { tryLoad } from "@/lib/api/load"
import { pageInfo, pageParams } from "@/lib/api/pagination"
import { formatDayMonth, formatNumber } from "@/lib/format"
import { hasPermission } from "@/lib/permissions/roles"
import { getPageParam, getParam, hrefWithParams, type ParamPatch, type SearchParamsRecord } from "@/lib/search-params"
import type { CurrentUser } from "@/lib/session/current-user"

const CLIENTS_PAGE_SIZE = 25

const STATUS_FILTERS: readonly { value: ClientStatus | null; label: string }[] = [
  { value: null, label: "Все" },
  { value: "active", label: "Есть сделка в работе" },
  { value: "archive", label: "Архив" },
]

type ClientsViewProps = {
  user: CurrentUser
  params: SearchParamsRecord
}

export async function ClientsView({ user, params }: ClientsViewProps) {
  const isTeamView = hasPermission(user.role, "team.view")
  const statusParam = getParam(params, "status")
  const status = STATUS_FILTERS.find((item) => item.value === statusParam)?.value ?? null
  const paging = pageParams(getPageParam(params), CLIENTS_PAGE_SIZE)
  const openClientId = getParam(params, "client")
  const href = (patch: ParamPatch) => hrefWithParams(routes.clientBase, params, patch)

  const loaded = await tryLoad(() =>
    Promise.all([
      clientsRepository.listClients({
        search: getParam(params, "q"),
        status,
        managerId: isTeamView ? getParam(params, "manager") : null,
        ...paging,
      }),
      isTeamView ? teamRepository.listMembers() : Promise.resolve([]),
      openClientId ? clientsRepository.getClient(openClientId) : Promise.resolve(null),
    ])
  )
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const [result, members, openClient] = loaded.data
  // Переход по строке не сбрасывает страницу: page сохраняется явно
  const clientHref = (id: string | null) => href({ client: id, page: getParam(params, "page") })

  return (
    <div className="space-y-3">
      <Toolbar>
        <SearchInput label="Поиск клиентов" placeholder="Имя или номер телефона" className="w-full sm:w-80" />
        <SegmentedLinks
          label="Статус клиента"
          variant="pill"
          items={STATUS_FILTERS.map((item) => ({
            key: item.value ?? "all",
            label: item.label,
            href: href({ status: item.value, client: null }),
            isActive: item.value === status,
          }))}
        />
        {isTeamView && (
          <FilterSelect
            label="Ответственный"
            param="manager"
            allLabel="Все сотрудники"
            options={members.map((member) => ({ value: member.id, label: member.name }))}
          />
        )}
      </Toolbar>

      {result.results.length === 0 ? (
        <ListPanel>
          <EmptyState
            icon={Users}
            title={getParam(params, "q") ? "Никого не нашли" : "Клиентов нет"}
            description="Проверьте написание имени или введите больше цифр номера — поиск идёт по всей истории, включая архив."
          />
        </ListPanel>
      ) : (
        <ListPanel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="text-left text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
                <tr>
                  <th scope="col" className="h-9 px-3 font-medium">Клиент</th>
                  <th scope="col" className="h-9 px-3 font-medium">Сделки</th>
                  {isTeamView && <th scope="col" className="h-9 px-3 font-medium">Ответственный</th>}
                  <th scope="col" className="h-9 px-3 text-right font-medium">Последний контакт</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.results.map((client) => (
                  <tr
                    key={client.id}
                    className="relative transition-colors hover:bg-accent/50 focus-within:bg-accent/50 aria-selected:bg-accent"
                    aria-selected={client.id === openClientId}
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={clientHref(client.id)}
                        scroll={false}
                        className="font-medium after:absolute after:inset-0 focus-visible:outline-none"
                      >
                        {client.name}
                      </Link>
                      <p className="text-meta text-muted-foreground tabular-nums">
                        {[client.phones[0], client.city].filter(Boolean).join(" · ") || "Контакты не указаны"}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-meta">
                      {client.currentDeal ? (
                        <span>{client.currentDeal.stageName}</span>
                      ) : (
                        <span className="text-muted-foreground">Архив</span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(client.openDealsCount)} в работе из {formatNumber(client.dealsCount)}
                      </p>
                    </td>
                    {isTeamView && (
                      <td className="px-3 py-2 text-meta whitespace-nowrap">
                        {client.manager ? (
                          <span className="flex items-center gap-2">
                            <PersonAvatar name={client.manager.name} />
                            {client.manager.name}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right text-meta whitespace-nowrap text-muted-foreground">
                      {client.lastInteractionAt ? formatDayMonth(client.lastInteractionAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListPanel>
      )}
      <PaginationNav info={pageInfo(result.count, paging)} hrefForPage={(page) => href({ page: page > 1 ? String(page) : null })} />

      {openClient && (
        <UrlSheet closeHref={clientHref(null)}>
          <ClientDetailContent client={openClient} />
        </UrlSheet>
      )}
    </div>
  )
}

export function ClientsViewSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-8 w-96" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  )
}
