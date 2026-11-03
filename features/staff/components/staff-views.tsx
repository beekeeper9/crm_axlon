import { Suspense } from "react"
import Link from "next/link"
import { connection } from "next/server"
import { Building2, Send, UserPlus, Users } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { departmentRoute, routes } from "@/config/routes"
import { staffRepository } from "@/features/staff/api/staff-repository"
import { CreateStaffFlow } from "@/features/staff/components/create-staff-flow"
import { DepartmentForm } from "@/features/staff/components/department-form"
import { StaffRequests } from "@/features/staff/components/staff-requests"
import { StaffRowActions } from "@/features/staff/components/staff-row-actions"
import type { AccountStatus, StaffMember } from "@/features/staff/schemas"
import { UrlSheet } from "@/components/shared/url-sheet"
import { companyDays, listWorkSessions, type StaffSession } from "@/features/staff/api/work-sessions"
import { formatWorkDuration, groupStaff, todayActivity, type TodayActivity } from "@/features/staff/lib/staff-structure"
import { tryLoad } from "@/lib/api/load"
import { formatDayMonth, formatNumber, formatTime, pluralize } from "@/lib/format"
import { getParam, hrefWithParams, type SearchParamsRecord } from "@/lib/search-params"
import { ROLE_LABELS } from "@/lib/permissions/roles"

const STATUS_META: Record<AccountStatus, { label: string; tone: StatusTone }> = {
  active: { label: "Активен", tone: "success" },
  invited: { label: "Ждёт первого входа", tone: "warning" },
  deactivated: { label: "Отключён", tone: "neutral" },
}

/** «Сотрудники»: по отделам — РОП и его менеджеры; директор видит компанию, РОП — свой отдел */
export async function StaffListView({
  canHire,
  canDecide,
  currentUserId,
  currentLogin,
  params,
}: {
  canHire: boolean
  /** Решения по заявкам — директор */
  canDecide: boolean
  currentUserId: string
  /** Свою строку не отключают и не сбрасывают (id в списке — членство, поэтому по логину) */
  currentLogin: string
  params: SearchParamsRecord
}) {
  // «Сегодня» — момент запроса, а не сборки: страница всегда рендерится на запрос
  await connection()
  const { today } = companyDays(0)
  const loaded = await tryLoad(() =>
    Promise.all([
      staffRepository.listStaff(),
      staffRepository.getCreateOptions(),
      staffRepository.listRequests(),
      isMockDataSource ? Promise.resolve(null) : listWorkSessions({ dateFrom: today, dateTo: today }).catch(() => null),
    ])
  )
  const title = "Сотрудники"

  if (!loaded.ok) {
    return (
      <div className="space-y-5">
        <PageHeader title={title} />
        <ApiErrorState error={loaded.error} />
      </div>
    )
  }
  const [members, options, requests, todaySessions] = loaded.data
  const isRequest = options.mode === "request"
  const createLabel = options.creatableRole && (canHire || isRequest) ? "Добавить сотрудника" : null
  const count = `${formatNumber(members.length)} ${pluralize(members.length, ["сотрудник", "сотрудника", "сотрудников"])}`
  const structure = groupStaff(members)
  const sessionsByUser = Map.groupBy(todaySessions ?? [], (session) => session.userId)
  const memberId = getParam(params, "member")
  const openMember = memberId ? members.find((member) => member.userId === memberId) ?? null : null
  const tableProps = {
    currentLogin,
    canHire,
    activityOf: (member: StaffMember) => (todaySessions ? todayActivity(sessionsByUser.get(member.userId) ?? []) : null),
    historyHref: (member: StaffMember) => hrefWithParams(routes.staff, params, { member: member.userId }),
    canManage: (member: StaffMember) => !isMockDataSource && member.status !== "deactivated" && (canDecide || MANAGED_BY_HEAD.has(member.role)),
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={
          options.fixedDepartment
            ? `Отдел «${options.fixedDepartment.name}» · ${count}. Менеджеров отдела вы добавляете и отключаете сами`
            : `${count} в вашей области`
        }
        actions={
          createLabel && (
            <Link href={routes.staffNew} className={buttonVariants({ size: "lg" })}>
              {isRequest ? <Send data-icon="inline-start" aria-hidden /> : <UserPlus data-icon="inline-start" aria-hidden />}
              {createLabel}
            </Link>
          )
        }
      />
      <StaffRequests requests={requests} canDecide={canDecide} currentUserId={currentUserId} />
      {members.length === 0 ? (
        <ListPanel>
          <EmptyState icon={Users} title="Пока никого нет" description="Создайте первый аккаунт — данные для входа появятся сразу после создания." />
        </ListPanel>
      ) : (
        <>
          {structure.departments.map((group) => (
            <section key={group.department.id} aria-labelledby={`dept-${group.department.id}`} className="space-y-2">
              <h2 id={`dept-${group.department.id}`} className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold">
                {group.department.name}
                <span className="text-meta font-normal text-muted-foreground">
                  РОП: {group.head ? group.head.fullName : "не назначен"} · {formatNumber(group.members.length)}{" "}
                  {pluralize(group.members.length, ["сотрудник", "сотрудника", "сотрудников"])}
                </span>
              </h2>
              <StaffTable members={group.head ? [group.head, ...group.members] : group.members} headId={group.head?.id ?? null} {...tableProps} />
            </section>
          ))}
          {structure.withoutDepartment.length > 0 && (
            <section aria-labelledby="dept-none" className="space-y-2">
              <h2 id="dept-none" className="text-base font-semibold">
                Без отдела
              </h2>
              <StaffTable members={structure.withoutDepartment} headId={null} {...tableProps} />
            </section>
          )}
        </>
      )}
      {todaySessions === null && !isMockDataSource && (
        <p className="text-meta text-muted-foreground">Не удалось загрузить смены сотрудников — активность за сегодня не показана.</p>
      )}
      {openMember && (
        <UrlSheet closeHref={hrefWithParams(routes.staff, params, { member: null })}>
          <Suspense fallback={<Skeleton className="m-4 h-64" />}>
            <SessionHistory member={openMember} />
          </Suspense>
        </UrlSheet>
      )}
    </div>
  )
}

/** Кем РОП управляет сам: сотрудниками своего отдела ниже себя (остальное — директор) */
const MANAGED_BY_HEAD: ReadonlySet<StaffMember["role"]> = new Set(["manager", "lead_caller"])

function ActivityCell({ activity }: { activity: TodayActivity | null }) {
  if (activity === null) return <span className="text-muted-foreground">—</span>
  switch (activity.kind) {
    case "none":
      return <span className="text-muted-foreground">Сегодня не работал</span>
    case "working":
      return (
        <span>
          <StatusBadge tone="success">Работает</StatusBadge>
          <span className="block text-xs text-muted-foreground">с {formatTime(activity.since)}</span>
        </span>
      )
    case "finished":
      return (
        <span>
          {formatTime(activity.startedAt)}–{formatTime(activity.endedAt)}
          {activity.seconds !== null && activity.seconds > 0 && <span className="block text-xs text-muted-foreground">{formatWorkDuration(activity.seconds)}</span>}
        </span>
      )
    case "unconfirmed":
      return (
        <span>
          с {formatTime(activity.startedAt)}
          <span className="block text-xs text-warning">конец не отмечен</span>
        </span>
      )
  }
}

function StaffTable({
  members,
  headId,
  currentLogin,
  canManage,
  canHire,
  activityOf,
  historyHref,
}: {
  members: readonly StaffMember[]
  /** Строка РОПа отдела выделяется */
  headId: string | null
  currentLogin: string
  canManage: (member: StaffMember) => boolean
  canHire: boolean
  activityOf: (member: StaffMember) => TodayActivity | null
  historyHref: (member: StaffMember) => string
}) {
  return (
    <ListPanel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
            <tr>
              <th scope="col" className="h-9 px-4 font-medium">Сотрудник</th>
              <th scope="col" className="h-9 px-3 font-medium">Роль</th>
              <th scope="col" className="h-9 px-3 font-medium">Статус</th>
              <th scope="col" className="h-9 px-3 font-medium">Работа сегодня</th>
              <th scope="col" className="h-9 px-3 text-right font-medium">Создан</th>
              <th scope="col" className="h-9 px-4 text-right font-medium">
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((member) => (
              <tr key={member.id} className={member.id === headId ? "bg-muted/30" : undefined}>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{member.fullName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{member.login}</p>
                </td>
                <td className="px-3 py-2.5 text-meta">{ROLE_LABELS[member.role]}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge tone={STATUS_META[member.status].tone}>{STATUS_META[member.status].label}</StatusBadge>
                </td>
                <td className="px-3 py-2.5 text-meta tabular-nums">
                  <ActivityCell activity={activityOf(member)} />
                  {!isMockDataSource && (
                    <Link href={historyHref(member)} scroll={false} className="text-xs text-primary hover:underline">
                      История смен
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-meta text-muted-foreground">
                  {formatDayMonth(member.createdAt)}
                  {member.createdBy && <span className="block text-xs">{member.createdBy.name}</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {member.login !== currentLogin && canManage(member) && <StaffRowActions member={member} canDeactivate={canHire} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListPanel>
  )
}

const SESSION_STATUS: Record<StaffSession["status"], { label: string; tone: StatusTone }> = {
  open: { label: "Идёт", tone: "success" },
  closed: { label: "Завершена", tone: "neutral" },
  unconfirmed: { label: "Конец не отмечен", tone: "warning" },
}

/** Смены сотрудника за 14 дней: начало, конец и длительность; смены — данные backend */
async function SessionHistory({ member }: { member: StaffMember }) {
  const { today, from } = companyDays(13)
  const loaded = await tryLoad(() => listWorkSessions({ userId: member.userId, dateFrom: from, dateTo: today }))
  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-base font-semibold">{member.fullName}</h2>
        <p className="text-meta text-muted-foreground">Рабочие смены за 14 дней. Смена начинается при входе в систему или кнопкой, заканчивается при выходе.</p>
      </div>
      {!loaded.ok ? (
        <ApiErrorState error={loaded.error} bare />
      ) : loaded.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">За 14 дней смен нет.</p>
      ) : (
        <ul className="divide-y rounded-xl ring-1 ring-border">
          {loaded.data.map((session) => (
            <li key={session.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{formatDayMonth(session.startedAt)}</span>{" "}
                <span className="tabular-nums">
                  {formatTime(session.startedAt)}–{session.endedAt ? formatTime(session.endedAt) : "…"}
                </span>
              </span>
              <span className="flex items-center gap-2 text-meta text-muted-foreground">
                {session.durationSeconds !== null && session.durationSeconds > 0 && formatWorkDuration(session.durationSeconds)}
                <StatusBadge tone={SESSION_STATUS[session.status].tone}>{SESSION_STATUS[session.status].label}</StatusBadge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export async function CreateStaffView() {
  const loaded = await tryLoad(() => staffRepository.getCreateOptions())
  const isRequest = loaded.ok && loaded.data.mode === "request"
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="Добавить сотрудника"
        description={isRequest ? "Директор одобрит заявку — тогда аккаунт будет создан" : "Пароль система придумает сама и покажет один раз — его нужно передать сотруднику"}
      />
      <div className="rounded-xl bg-card p-5 ring-1 ring-border sm:p-6">
        {!loaded.ok ? (
          <ApiErrorState error={loaded.error} bare />
        ) : !loaded.data.creatableRole ? (
          <EmptyState icon={Users} title="Нельзя создавать аккаунты" description="У вашей роли нет права создавать сотрудников или вы не назначены в отдел." />
        ) : (
          <CreateStaffFlow options={loaded.data} backHref={routes.staff} isDemo={isMockDataSource} />
        )}
      </div>
    </div>
  )
}

/** Рабочее пространство директора: компания, отделы и их руководители */
export async function CompanyView({ companyName }: { companyName: string }) {
  const loaded = await tryLoad(() => Promise.all([staffRepository.listStaff(), staffRepository.getCreateOptions()]))
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const [members, options] = loaded.data

  return (
    <div className="space-y-6">
      <PageHeader
        title={companyName || "Компания"}
        description="Отделы продаж, их руководители и команды. Назначьте каждому отделу РОПа"
        actions={
          <>
            <Link href={routes.staff} className={buttonVariants({ variant: "outline", size: "lg" })}>
              Все сотрудники
            </Link>
            <Link href={routes.staffNew} className={buttonVariants({ size: "lg" })}>
              <UserPlus data-icon="inline-start" aria-hidden />
              Добавить РОПа
            </Link>
          </>
        }
      />
      {!isMockDataSource && <DepartmentForm />}
      {options.departments.length === 0 && (
        <ListPanel>
          <EmptyState icon={Building2} title="Отделов пока нет" description="Создайте отдел продаж, затем добавьте РОПа и выберите этот отдел." />
        </ListPanel>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {options.departments.map((department) => {
          const people = members.filter((member) => member.department?.id === department.id)
          const heads = people.filter((member) => member.role === "head_of_sales")
          const managers = people.filter((member) => member.role === "manager" && member.status !== "deactivated")
          return (
            <Link
              key={department.id}
              href={departmentRoute(department.id)}
              aria-label={`${department.name}: показатели отдела`}
              className="block space-y-3 rounded-xl bg-card p-4 ring-1 ring-border transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <h2 className="text-base font-semibold">{department.name}</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Руководитель</dt>
                  <dd className={heads.length ? "font-medium" : "text-warning"}>{heads.map((head) => head.fullName).join(", ") || "Не назначен"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Менеджеров</dt>
                  <dd className="font-medium tabular-nums">{formatNumber(managers.length)}</dd>
                </div>
              </dl>
            </Link>
          )
        })}
      </div>
      <p className="text-meta text-muted-foreground">
        Нажмите на отдел, чтобы открыть его показатели. Руководители всех отделов — в разделе <Link href={routes.heads} className="text-primary hover:underline">«РОПы»</Link>.
      </p>
    </div>
  )
}

export function StaffSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
