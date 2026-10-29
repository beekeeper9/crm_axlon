import Link from "next/link"
import { Building2, UserPlus, Users } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { staffRepository } from "@/features/staff/api/staff-repository"
import { CreateStaffFlow } from "@/features/staff/components/create-staff-flow"
import type { AccountStatus, StaffMember } from "@/features/staff/schemas"
import { tryLoad } from "@/lib/api/load"
import { formatDayMonth, formatNumber, pluralize } from "@/lib/format"
import { ROLE_LABELS } from "@/lib/permissions/roles"

const STATUS_META: Record<AccountStatus, { label: string; tone: StatusTone }> = {
  active: { label: "Активен", tone: "success" },
  invited: { label: "Ждёт первого входа", tone: "warning" },
  deactivated: { label: "Отключён", tone: "neutral" },
}

/** «Сотрудники» (директор, РОП) и «Платформа» (администратор): кого видит пользователь в своей области */
export async function StaffListView({ mode }: { mode: "company" | "platform" }) {
  const loaded = await tryLoad(() => Promise.all([staffRepository.listStaff(), staffRepository.getCreateOptions()]))
  const isPlatform = mode === "platform"
  const newHref = isPlatform ? routes.platformNew : routes.staffNew
  const title = isPlatform ? "Компании и директора" : "Сотрудники"

  if (!loaded.ok) {
    return (
      <div className="space-y-5">
        <PageHeader title={title} />
        <ApiErrorState error={loaded.error} />
      </div>
    )
  }
  const [members, options] = loaded.data
  const createLabel = options.creatableRole ? `Добавить: ${ROLE_LABELS[options.creatableRole].toLowerCase()}` : null

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={
          isPlatform
            ? "Администратор платформы создаёт директоров компаний; работой отделов управляют сами компании"
            : options.fixedDepartment
              ? `Отдел «${options.fixedDepartment.name}» · ${formatNumber(members.length)} ${pluralize(members.length, ["сотрудник", "сотрудника", "сотрудников"])}`
              : `${formatNumber(members.length)} ${pluralize(members.length, ["сотрудник", "сотрудника", "сотрудников"])} в вашей области`
        }
        actions={
          createLabel && (
            <Link href={newHref} className={buttonVariants({ size: "lg" })}>
              <UserPlus data-icon="inline-start" aria-hidden />
              {createLabel}
            </Link>
          )
        }
      />
      {members.length === 0 ? (
        <ListPanel>
          <EmptyState icon={isPlatform ? Building2 : Users} title="Пока никого нет" description="Создайте первый аккаунт — данные для входа появятся сразу после создания." />
        </ListPanel>
      ) : (
        <StaffTable members={members} isPlatform={isPlatform} />
      )}
    </div>
  )
}

function StaffTable({ members, isPlatform }: { members: readonly StaffMember[]; isPlatform: boolean }) {
  return (
    <ListPanel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
            <tr>
              <th scope="col" className="h-9 px-4 font-medium">Сотрудник</th>
              <th scope="col" className="h-9 px-3 font-medium">{isPlatform ? "Компания" : "Роль и отдел"}</th>
              <th scope="col" className="h-9 px-3 font-medium">Статус</th>
              <th scope="col" className="h-9 px-4 text-right font-medium">Создан</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{member.fullName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{member.login}</p>
                </td>
                <td className="px-3 py-2.5 text-meta">
                  {isPlatform ? (
                    member.company?.name ?? "—"
                  ) : (
                    <>
                      {ROLE_LABELS[member.role]}
                      {member.department && <span className="block text-xs text-muted-foreground">{member.department.name}</span>}
                    </>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge tone={STATUS_META[member.status].tone}>{STATUS_META[member.status].label}</StatusBadge>
                </td>
                <td className="px-4 py-2.5 text-right text-meta text-muted-foreground">
                  {formatDayMonth(member.createdAt)}
                  {member.createdBy && <span className="block text-xs">{member.createdBy.name}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListPanel>
  )
}

export async function CreateStaffView({ mode }: { mode: "company" | "platform" }) {
  const backHref = mode === "platform" ? routes.platform : routes.staff
  const loaded = await tryLoad(() => staffRepository.getCreateOptions())
  const title = mode === "platform" ? "Новый директор компании" : "Новый сотрудник"
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title={title} description="Пароль система придумает сама и покажет один раз — его нужно передать сотруднику" />
      <div className="rounded-xl bg-card p-5 ring-1 ring-border sm:p-6">
        {!loaded.ok ? (
          <ApiErrorState error={loaded.error} bare />
        ) : !loaded.data.creatableRole ? (
          <EmptyState icon={Users} title="Нельзя создавать аккаунты" description="У вашей роли нет права создавать сотрудников." />
        ) : (
          <CreateStaffFlow options={loaded.data} backHref={backHref} isDemo={isMockDataSource} />
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
        description="Отделы продаж, их руководители и команды"
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
      <div className="grid gap-3 md:grid-cols-2">
        {options.departments.map((department) => {
          const people = members.filter((member) => member.department?.id === department.id)
          const heads = people.filter((member) => member.role === "head_of_sales")
          const managers = people.filter((member) => member.role === "manager" && member.status !== "deactivated")
          return (
            <section key={department.id} className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border">
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
            </section>
          )
        })}
      </div>
      <p className="text-meta text-muted-foreground">
        Показатели отдела — в <Link href={routes.team} className="text-primary hover:underline">Кабинете РОПа</Link>. Отдельные аналитические экраны директора — следующий этап.
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
