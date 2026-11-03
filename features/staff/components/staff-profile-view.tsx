import Link from "next/link"
import { ArrowLeft, Download, UserX } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { staffRepository } from "@/features/staff/api/staff-repository"
import { fetchFormerBase, fetchMemberDetail } from "@/features/staff/api/staff-profile"
import { companyDays, listWorkSessions } from "@/features/staff/api/work-sessions"
import { BaseRedistribution } from "@/features/staff/components/base-redistribution"
import { DeleteMemberButton } from "@/features/staff/components/delete-member-button"
import { formatWorkDuration } from "@/features/staff/lib/staff-structure"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { formatDateTime, formatDayMonth, formatFullDate, formatNumber, formatTime } from "@/lib/format"
import { ROLE_LABELS } from "@/lib/permissions/roles"

/** Подписи видов истории работы — ключи `history` из `GET /staff/{id}/` */
const HISTORY_LABELS: Record<string, string> = {
  leads: "Лиды",
  customers: "Клиенты",
  deals: "Сделки",
  stage_changes: "Смены этапов",
  activities: "Задачи и события",
  meetings: "Встречи",
  calls: "Звонки",
  payments: "Оплаты",
  invoices: "Счета",
  conversations: "Переписки",
  messages: "Сообщения",
  plans: "Планы",
  plan_changes: "Изменения планов",
  absences: "Отсутствия",
  work_sessions: "Рабочие смены",
  actions: "Действия в CRM",
  transferred_leads: "Передано лидов",
  transferred_customers: "Передано клиентов",
  transferred_deals: "Передано сделок",
}

const TASK_STATUS: Record<string, string> = { open: "Открыта", completed: "Выполнена", cancelled: "Отменена" }

/**
 * Профиль сотрудника — прежде всего уволенного: кто он, что успел сделать, его лиды, клиенты,
 * сделки и задачи. Директор и РОП его отдела передают базу действующим сотрудникам, скачивают
 * лиды; директор удаляет аккаунт, только если истории работы нет.
 */
export async function StaffProfileView({ membershipId, isDirector }: { membershipId: string; isDirector: boolean }) {
  if (isMockDataSource) {
    return (
      <ListPanel>
        <EmptyState icon={UserX} title="Профиль сотрудника работает только с сервером" description="В демо-режиме истории работы и базы сотрудников нет." />
      </ListPanel>
    )
  }
  const auth = await getRenderAuth()
  const detail = await tryLoad(() => fetchMemberDetail(auth, membershipId))
  if (!detail.ok) return <ApiErrorState error={detail.error} />
  const member = detail.data
  const { today, from } = companyDays(29)
  const [base, staff, sessions] = await Promise.all([
    tryLoad(() => fetchFormerBase(auth, member.userId)),
    tryLoad(() => staffRepository.listStaff()),
    tryLoad(() => listWorkSessions({ userId: member.userId, dateFrom: from, dateTo: today }, auth)),
  ])
  const isDismissed = member.status === "deactivated"
  // Кому передать базу: действующие сотрудники продаж (РОПу backend даст только его отдел)
  const recipients = staff.ok
    ? staff.data
        .filter((m) => m.status !== "deactivated" && m.userId !== member.userId && ["manager", "lead_caller", "head_of_sales"].includes(m.role))
        .filter((m) => isDirector || (member.department !== null && m.department?.id === member.department.id))
        .map((m) => ({ userId: m.userId, name: m.fullName, department: m.department?.name ?? null }))
    : []
  const historyRows = Object.entries(member.history).filter(([, value]) => value > 0)

  return (
    <div className="space-y-6">
      <Link href={routes.staff} className="inline-flex items-center gap-1 text-meta text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden />
        Сотрудники
      </Link>
      <PageHeader
        title={member.fullName}
        description={[ROLE_LABELS[member.role], member.department?.name ? `отдел «${member.department.name}»` : "без отдела", member.login].join(" · ")}
        actions={
          <>
            {base.ok && base.data.leads.length > 0 && (
              <a href={`/exports/staff-leads/${encodeURIComponent(membershipId)}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                <Download data-icon="inline-start" aria-hidden />
                Скачать базу лидов (CSV)
              </a>
            )}
            {isDirector && member.canDelete && <DeleteMemberButton membershipId={membershipId} fullName={member.fullName} />}
          </>
        }
      />

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl px-4 py-3 ring-1 ring-border">
          <dt className="text-meta text-muted-foreground">Статус</dt>
          <dd className="pt-1">
            {isDismissed ? <StatusBadge tone="neutral">Уволен · вход заблокирован</StatusBadge> : <StatusBadge tone="success">Работает</StatusBadge>}
          </dd>
        </div>
        <div className="rounded-xl px-4 py-3 ring-1 ring-border">
          <dt className="text-meta text-muted-foreground">В компании с</dt>
          <dd className="pt-1 font-medium">{formatFullDate(member.createdAt)}</dd>
        </div>
        <div className="rounded-xl px-4 py-3 ring-1 ring-border">
          <dt className="text-meta text-muted-foreground">Последний вход</dt>
          <dd className="pt-1 font-medium">{member.lastLogin ? formatDateTime(member.lastLogin) : "—"}</dd>
        </div>
      </dl>

      <section aria-labelledby="work-history" className="space-y-2">
        <h2 id="work-history" className="text-base font-semibold">
          История работы
        </h2>
        {historyRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Истории работы нет.{isDirector && member.canDelete ? " Аккаунт можно удалить." : ""}
          </p>
        ) : (
          <dl className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {historyRows.map(([kind, value]) => (
              <div key={kind} className="flex items-baseline justify-between rounded-lg px-3 py-2 ring-1 ring-border">
                <dt className="text-meta text-muted-foreground">{HISTORY_LABELS[kind] ?? kind}</dt>
                <dd className="font-semibold tabular-nums">{formatNumber(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {!base.ok ? (
        <ApiErrorState error={base.error} />
      ) : (
        <BaseRedistribution
          formerUserId={member.userId}
          isDismissed={isDismissed}
          leads={base.data.leads}
          customers={base.data.customers}
          deals={base.data.deals}
          recipients={recipients}
        />
      )}

      {base.ok && base.data.tasks.length > 0 && (
        <section aria-labelledby="tasks-history" className="space-y-2">
          <h2 id="tasks-history" className="text-base font-semibold">
            Задачи · {formatNumber(base.data.tasks.length)}
          </h2>
          <ListPanel>
            <ul className="divide-y text-sm">
              {base.data.tasks.slice(0, 50).map((task) => (
                <li key={task.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2">
                  <span>
                    {task.title || "Без названия"}
                    {task.result && <span className="block text-meta text-muted-foreground">Итог: {task.result}</span>}
                  </span>
                  <span className="text-meta text-muted-foreground">
                    {TASK_STATUS[task.taskStatus]}
                    {task.dueDate && ` · срок ${formatDayMonth(task.dueDate)}`}
                  </span>
                </li>
              ))}
            </ul>
          </ListPanel>
        </section>
      )}

      <section aria-labelledby="shifts-history" className="space-y-2">
        <h2 id="shifts-history" className="text-base font-semibold">
          Рабочие смены за 30 дней
        </h2>
        {!sessions.ok ? (
          <ApiErrorState error={sessions.error} bare />
        ) : sessions.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Смен нет.</p>
        ) : (
          <ul className="divide-y rounded-xl text-sm ring-1 ring-border">
            {sessions.data.slice(0, 30).map((session) => (
              <li key={session.id} className="flex justify-between gap-2 px-4 py-2">
                <span>
                  {formatDayMonth(session.startedAt)} · {formatTime(session.startedAt)}–{session.endedAt ? formatTime(session.endedAt) : "конец не отмечен"}
                </span>
                <span className="text-meta text-muted-foreground">{session.durationSeconds ? formatWorkDuration(session.durationSeconds) : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function StaffProfileSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
