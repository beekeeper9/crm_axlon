import { Suspense } from "react"
import Link from "next/link"
import { ExternalLink, Mail, MapPin, Phone } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { leadRoute } from "@/config/routes"
import { LeadStageControl } from "@/features/leads/components/lead-stage-control"
import {
  LeadAiContext,
  LeadCalls,
  LeadFields,
  LeadNextStep,
  LeadPayment,
  LeadTimeline,
} from "@/features/leads/components/lead-sections"
import { LeadTabs } from "@/features/leads/components/lead-tabs"
import type { LeadDetail } from "@/features/leads/schemas"
import { MeetingsList, meetingsRepository } from "@/features/meetings"
import { TasksList, tasksRepository } from "@/features/tasks"
import { teamRepository } from "@/features/team"
import { PAGE_LIMIT_MAX } from "@/lib/api/pagination"
import { formatDayMonth, formatDecimalMoney, formatFullDate } from "@/lib/format"
import { editModeFor } from "@/lib/permissions/edit-mode"
import { hasPermission } from "@/lib/permissions/roles"
import type { CurrentUser } from "@/lib/session/current-user"

type LeadViewProps = {
  lead: LeadDetail
  user: CurrentUser
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`
}

export function LeadView({ lead, user }: LeadViewProps) {
  const stage = lead.pipeline.stages.find((item) => item.id === lead.stageId)
  const primaryPhone = lead.client.phones[0]

  return (
    <div className="space-y-5">
      <PageHeader
        title={lead.title}
        description={[stage?.name, lead.amount && lead.currency ? formatDecimalMoney(lead.amount, lead.currency) : null]
          .filter(Boolean)
          .join(" · ")}
        actions={
          primaryPhone && (
            <a href={telHref(primaryPhone)} className={buttonVariants({ variant: "outline" })}>
              <Phone data-icon="inline-start" aria-hidden />
              Позвонить
            </a>
          )
        }
      />

      <LeadStageControl
        pipelineName={lead.pipeline.name}
        stages={lead.pipeline.stages}
        stageId={lead.stageId}
        editMode={editModeFor(user.role)}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <LeadNextStep lead={lead} />
          <LeadAiContext lead={lead} isDemoData={isMockDataSource} />
          <LeadTabs
            tabs={[
              { value: "work", label: "Работа", content: <Deferred><LeadWork lead={lead} user={user} /></Deferred> },
              { value: "history", label: "История", content: <Deferred><LeadTimeline leadId={lead.id} /></Deferred> },
              { value: "calls", label: "Звонки", content: <Deferred><LeadCalls leadId={lead.id} isDemoData={isMockDataSource} /></Deferred> },
              { value: "payment", label: "Оплата", content: <LeadPayment lead={lead} /> },
              { value: "data", label: "Данные", content: <LeadFields lead={lead} /> },
            ]}
          />
        </div>
        <LeadAside lead={lead} />
      </div>
    </div>
  )
}

/** Каждая вкладка загружается независимо: медленная история не задерживает остальную карточку */
function Deferred({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>{children}</Suspense>
}

async function LeadWork({ lead, user }: LeadViewProps) {
  const isTeamView = hasPermission(user.role, "team.view")
  const leadRef = { id: lead.id, name: lead.title }
  const [tasks, meetings, members] = await Promise.all([
    tasksRepository.listTasks({ status: "all", assigneeId: null, leadId: lead.id, search: null, limit: PAGE_LIMIT_MAX, offset: 0 }),
    meetingsRepository.listMeetings({
      period: null,
      status: null,
      hostId: null,
      leadId: lead.id,
      search: null,
      outcomeRequired: false,
      limit: PAGE_LIMIT_MAX,
      offset: 0,
    }),
    isTeamView ? teamRepository.listMembers() : Promise.resolve([]),
  ])
  const editMode = editModeFor(user.role)
  const currentUser = { id: user.id, name: user.fullName }

  return (
    <div className="space-y-6">
      <section aria-labelledby="lead-tasks" className="space-y-2">
        <h2 id="lead-tasks" className="text-sm font-semibold">Задачи</h2>
        <TasksList
          initialTasks={tasks.results}
          members={members}
          currentUser={currentUser}
          canAssign={hasPermission(user.role, "records.assign")}
          editMode={editMode}
          showAssignee={isTeamView}
          lead={leadRef}
          emptyTitle="Задач по лиду нет"
          emptyDescription="Поставьте задачу — так следующий шаг не потеряется."
        />
      </section>
      <section aria-labelledby="lead-meetings" className="space-y-2">
        <h2 id="lead-meetings" className="text-sm font-semibold">Встречи</h2>
        <MeetingsList
          initialMeetings={meetings.results}
          editMode={editMode}
          showPeople
          lead={leadRef}
          leadOptions={[]}
          hosts={members}
          currentUser={currentUser}
          emptyTitle="Встреч не было"
          emptyDescription="Назначьте встречу, когда клиент будет готов."
        />
      </section>
    </div>
  )
}

function AsideRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}

function LeadAside({ lead }: { lead: LeadDetail }) {
  return (
    <aside className="space-y-4">
      <Card className="gap-3 px-4 py-4">
        <h2 className="text-sm font-semibold">Клиент</h2>
        <ul className="space-y-2 text-sm">
          {lead.client.phones.map((phone) => (
            <li key={phone}>
              <a href={telHref(phone)} className="flex items-center gap-2 hover:text-primary">
                <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                {phone}
              </a>
            </li>
          ))}
          {lead.client.email && (
            <li>
              <a href={`mailto:${lead.client.email}`} className="flex items-center gap-2 hover:text-primary">
                <Mail className="size-3.5 text-muted-foreground" aria-hidden />
                {lead.client.email}
              </a>
            </li>
          )}
          {lead.client.city && (
            <li className="flex items-center gap-2">
              <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
              {lead.client.city}
            </li>
          )}
          {lead.client.phones.length === 0 && !lead.client.email && <li className="text-muted-foreground">Контакты не указаны</li>}
        </ul>
      </Card>

      <Card className="gap-1 px-4 py-4">
        <h2 className="mb-1 text-sm font-semibold">Сделка</h2>
        <dl className="divide-y">
          <AsideRow label="Ответственный">
            <span className="inline-flex items-center gap-1.5">
              <PersonAvatar name={lead.manager.name} />
              {lead.manager.name}
            </span>
          </AsideRow>
          <AsideRow label="Сумма">
            {lead.amount && lead.currency ? formatDecimalMoney(lead.amount, lead.currency) : <span className="text-muted-foreground">не указана</span>}
          </AsideRow>
          <AsideRow label="На этапе с">{formatDayMonth(lead.stageEnteredAt)}</AsideRow>
          <AsideRow label="Источник">{lead.source ?? <span className="text-muted-foreground">—</span>}</AsideRow>
          <AsideRow label="Создан">{formatFullDate(lead.createdAt)}</AsideRow>
        </dl>
        {lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            {lead.tags.map((tag) => (
              <span key={tag} className="rounded bg-muted px-1.5 py-px text-xs text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </Card>

      {lead.related.length > 0 && (
        <Card className="gap-2 px-4 py-4">
          <h2 className="text-sm font-semibold">Другие сделки клиента</h2>
          <ul className="space-y-1.5 text-sm">
            {lead.related.map((item) => (
              <li key={item.id}>
                <Link href={leadRoute(item.id)} className="flex items-center justify-between gap-2 hover:text-primary">
                  <span className="truncate">{item.title}</span>
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
                <p className="text-xs text-muted-foreground">
                  {item.pipelineName} · {item.stageName}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </aside>
  )
}

export function LeadViewSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
