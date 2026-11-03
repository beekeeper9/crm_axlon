import Link from "next/link"
import { ClipboardCheck } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { StatusBadge } from "@/components/shared/status-badge"
import { leadRoute, routes } from "@/config/routes"
import { fetchReviewGroups, fetchTeamDeals, type ReviewItem } from "@/features/review/api/review-repository"
import { NewReviewForm } from "@/features/review/components/new-review-form"
import { listMembersIfAllowed } from "@/features/team"
import { tryLoad } from "@/lib/api/load"
import { formatDayMonth, formatNumber } from "@/lib/format"

const STATUS: Record<ReviewItem["status"], { label: string; tone: "info" | "success" | "danger" }> = {
  open: { label: "Выдано", tone: "info" },
  done: { label: "Сделано", tone: "success" },
  overdue: { label: "Просрочено", tone: "danger" },
}

/**
 * «Работа над ошибками»: РОП выдаёт пакеты разбора, менеджер видит свои и закрывает их
 * как обычные задачи (вкладка «Задачи» или карточка сделки).
 */
export async function ReviewView({ canIssue }: { canIssue: boolean }) {
  const [groups, members, deals] = await Promise.all([
    tryLoad(fetchReviewGroups),
    canIssue ? tryLoad(listMembersIfAllowed) : Promise.resolve(null),
    canIssue ? tryLoad(fetchTeamDeals) : Promise.resolve(null),
  ])
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Работа над ошибками</h1>
          <p className="text-meta text-muted-foreground">
            {canIssue
              ? "Пакеты разбора по сотрудникам: какие сделки отданы на доработку и что уже сделано."
              : "Сделки, которые РОП вернул на доработку. Выполните задачу в карточке сделки или в «Задачах»."}
          </p>
        </div>
      </header>
      {canIssue && members?.ok && deals?.ok && <NewReviewForm members={members.data} deals={deals.data} />}
      {!groups.ok ? (
        <ApiErrorState error={groups.error} />
      ) : groups.data.length === 0 ? (
        <ListPanel>
          <EmptyState icon={ClipboardCheck} title="Разборов нет" description={canIssue ? "Выдайте разбор: выберите сотрудника, сделки и что сделать." : "РОП пока не выдавал вам разборов."} />
        </ListPanel>
      ) : (
        groups.data.map((group) => (
          <section key={group.assignee.id} aria-labelledby={`review-${group.assignee.id}`} className="space-y-2">
            <h2 id={`review-${group.assignee.id}`} className="flex flex-wrap items-baseline gap-x-3 text-base font-semibold">
              {group.assignee.name}
              <span className="text-meta font-normal text-muted-foreground">
                выдано {formatNumber(group.issued)} · сделано {formatNumber(group.done)} · просрочено {formatNumber(group.overdue)}
              </span>
            </h2>
            <ListPanel>
              <ul className="divide-y">
                {group.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium">{item.title}</p>
                      {item.deal && (
                        <Link href={leadRoute(item.deal.id)} className="text-meta text-primary hover:underline">
                          {item.deal.title}
                        </Link>
                      )}
                      {item.note && <p className="text-meta text-muted-foreground">{item.note}</p>}
                      {item.result && <p className="text-meta">Результат: {item.result}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge tone={STATUS[item.status].tone}>{STATUS[item.status].label}</StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {item.status === "done" && item.completedAt ? `сделано ${formatDayMonth(item.completedAt)}` : item.dueDate ? `до ${formatDayMonth(item.dueDate)}` : "без срока"}
                        {item.issuedBy && ` · выдал(а) ${item.issuedBy}`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </ListPanel>
          </section>
        ))
      )}
      <p className="text-meta text-muted-foreground">
        Задачи разбора видны и в разделе <Link href={routes.tasks} className="text-primary hover:underline">«Задачи»</Link>.
      </p>
    </div>
  )
}
