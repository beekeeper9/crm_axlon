import { Suspense } from "react"
import Link from "next/link"
import { ExternalLink, Mail, MapPin, Phone } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { leadRoute } from "@/config/routes"
import { DealActions } from "@/features/leads/components/deal-actions"
import { DealPayments } from "@/features/leads/components/deal-payments"
import { LeadStageControl } from "@/features/leads/components/lead-stage-control"
import {
  LeadFields,
  LeadNowPanel,
  LeadPayment,
  LeadTimeline,
} from "@/features/leads/components/lead-sections"
import { LeadTabs } from "@/features/leads/components/lead-tabs"
import type { LeadDetail } from "@/features/leads/schemas"
import { LeadCallsList, LogCallButton } from "@/features/calls"
import { MeetingsList, meetingsRepository } from "@/features/meetings"
import { listProducts } from "@/features/products"
import { salesRepository } from "@/features/sales"
import { TasksList, tasksRepository } from "@/features/tasks"
import { listMembersIfAllowed } from "@/features/team"
import type { ApiError } from "@/lib/api/errors"
import { tryLoad } from "@/lib/api/load"
import { PAGE_LIMIT_MAX } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
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
  const primaryPhone = lead.client?.phones[0]

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">{lead.title}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted-foreground">
            {stage && <StatusBadge tone={stage.kind === "won" ? "success" : stage.kind === "lost" ? "danger" : "info"}>{stage.name}</StatusBadge>}
            <span className="font-semibold text-foreground tabular-nums">
              {lead.amount && lead.currency ? formatDecimalMoney(lead.amount, lead.currency) : "Сумма не указана"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PersonAvatar name={lead.manager.name} />
              {lead.manager.name}
            </span>
          </p>
        </div>
        {primaryPhone && (
          <a href={telHref(primaryPhone)} className={buttonVariants({ variant: "outline" })}>
            <Phone data-icon="inline-start" aria-hidden />
            Позвонить
          </a>
        )}
      </header>

      <LeadStageControl
        pipelineName={lead.pipeline.name}
        stages={lead.pipeline.stages}
        stageId={lead.stageId}
        editMode={editModeFor(user.role)}
        serverDealId={isMockDataSource ? null : lead.id}
        isOpenDeal={lead.status === "open"}
        dealTitle={lead.title}
      />

      {!isMockDataSource && hasPermission(user.role, "records.edit") && (
        <Suspense fallback={<Skeleton className="h-8 w-80" />}>
          <DealActionsSection lead={lead} user={user} />
        </Suspense>
      )}

      {/* Порядок в разметке — порядок на телефоне: сейчас → клиент → вкладки.
          На широком экране «Клиент и сделка» уходит в правую колонку на всю высоту. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:grid-rows-[auto_1fr] lg:gap-x-6">
        <LeadNowPanel lead={lead} isDemoData={isMockDataSource} />
        <LeadAside lead={lead} />
        <div className="min-w-0">
          <LeadTabs
            tabs={[
              { value: "work", label: "Работа", content: <Deferred><LeadWork lead={lead} user={user} /></Deferred> },
              { value: "history", label: "История", content: <Deferred><LeadTimeline leadId={lead.id} /></Deferred> },
              {
                value: "calls",
                label: "Звонки",
                content: (
                  <Deferred>
                    <LeadCallsList
                      leadId={lead.id}
                      actions={
                        !isMockDataSource && hasPermission(user.role, "records.edit") ? (
                          <LogCallButton subject={{ type: "deal", id: lead.id, name: lead.title }} phone={primaryPhone ?? null} variant="outline" />
                        ) : undefined
                      }
                    />
                  </Deferred>
                ),
              },
              {
                value: "payment",
                label: "Оплата",
                content: isMockDataSource ? (
                  <LeadPayment lead={lead} />
                ) : (
                  <Deferred>
                    <DealPayments dealId={lead.id} customerId={lead.customerId} currency={lead.currency} canRecord={hasPermission(user.role, "records.edit")} />
                  </Deferred>
                ),
              },
              { value: "data", label: "Данные", content: <LeadFields lead={lead} /> },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

/** Справочники для действий со сделкой: причины отказа и (для руководителя) сотрудники */
async function DealActionsSection({ lead, user }: LeadViewProps) {
  const canAssign = hasPermission(user.role, "records.assign")
  const [config, members, products] = await Promise.all([
    tryLoad(() => salesRepository.getConfig()),
    tryLoad(() => (canAssign ? listMembersIfAllowed() : Promise.resolve([]))),
    tryLoad(async () => (isMockDataSource ? [] : listProducts(await getRenderAuth(), true))),
  ])
  if (!config.ok) return <ApiErrorState error={config.error} bare />
  return (
    <DealActions
      lead={lead}
      lossReasons={config.data.lossReasons}
      members={members.ok ? members.data : []}
      products={products.ok ? products.data.map(({ id, name }) => ({ id, name })) : []}
    />
  )
}

/** Каждая вкладка загружается независимо: медленная история не задерживает остальную карточку */
function Deferred({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>{children}</Suspense>
}

async function LeadWork({ lead, user }: LeadViewProps) {
  const isTeamView = hasPermission(user.role, "team.view")
  const leadRef = { id: lead.id, name: lead.title }
  // Разделы загружаются отдельно: неподключённые встречи не должны скрывать задачи
  const [tasks, meetings, members] = await Promise.all([
    tryLoad(() =>
      tasksRepository.listTasks({ status: "all", assigneeId: null, leadId: lead.id, search: null, limit: PAGE_LIMIT_MAX, offset: 0 })
    ),
    tryLoad(() =>
      meetingsRepository.listMeetings({
        period: null,
        status: null,
        hostId: null,
        leadId: lead.id,
        search: null,
        outcomeRequired: false,
        limit: PAGE_LIMIT_MAX,
        offset: 0,
      })
    ),
    tryLoad(() => (isTeamView ? listMembersIfAllowed() : Promise.resolve([]))),
  ])
  if (!members.ok) return <ApiErrorState error={members.error} bare />
  const editMode = editModeFor(user.role)
  const currentUser = { id: user.id, name: user.fullName }

  return (
    <div className="space-y-6">
      {tasks.ok ? (
        <TasksList
          heading="Задачи"
          // Список отфильтрован по этому лиду, поэтому привязка известна, даже если backend отдал только id
          initialTasks={tasks.data.results.map((task) => ({ ...task, lead: task.lead ?? leadRef }))}
          members={members.data}
          currentUser={currentUser}
          canAssign={hasPermission(user.role, "records.assign")}
          editMode={editMode}
          showAssignee={isTeamView}
          lead={leadRef}
          remoteDealId={isMockDataSource ? null : lead.id}
          emptyTitle="Задач по лиду нет"
          emptyDescription="Поставьте задачу — так следующий шаг не потеряется."
        />
      ) : (
        <WorkSectionError heading="Задачи" error={tasks.error} />
      )}
      {meetings.ok ? (
        <MeetingsList
          heading="Встречи"
          initialMeetings={meetings.data.results}
          editMode={editMode}
          showPeople
          lead={leadRef}
          leadOptions={[]}
          hosts={members.data}
          currentUser={currentUser}
          emptyTitle="Встреч не было"
          emptyDescription="Назначьте встречу, когда клиент будет готов."
        />
      ) : (
        <WorkSectionError heading="Встречи" error={meetings.error} />
      )}
    </div>
  )
}

function WorkSectionError({ heading, error }: { heading: string; error: ApiError }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{heading}</h2>
      <ApiErrorState error={error} />
    </section>
  )
}

function AsideRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-meta">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}

function AsideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5 border-t px-4 py-3 first:border-t-0">
      <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

/** «Клиент и сделка»: справочные данные одной спокойной колонкой, без отдельных карточек */
function LeadAside({ lead }: { lead: LeadDetail }) {
  return (
    <aside className="self-start rounded-xl bg-card ring-1 ring-border lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <AsideSection title="Клиент">
        {lead.client ? <ClientContacts client={lead.client} /> : (
          <p className="text-meta text-muted-foreground">Клиент не привязан к сделке или у вас нет доступа к его данным</p>
        )}
      </AsideSection>

      <AsideSection title="Сделка">
        <dl>
          <AsideRow label="Воронка">{lead.pipeline.name}</AsideRow>
          <AsideRow label="На этапе с">{formatDayMonth(lead.stageEnteredAt)}</AsideRow>
          <AsideRow label="Источник">{lead.source ?? <span className="text-muted-foreground">—</span>}</AsideRow>
          <AsideRow label="Создан">{formatFullDate(lead.createdAt)}</AsideRow>
        </dl>
        {lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {lead.tags.map((tag) => (
              <span key={tag} className="rounded bg-muted px-1.5 text-xs leading-5 text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </AsideSection>

      {lead.related.length > 0 && (
        <AsideSection title="Другие сделки клиента">
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
        </AsideSection>
      )}
    </aside>
  )
}

function ClientContacts({ client }: { client: NonNullable<LeadDetail["client"]> }) {
  return (
    <ul className="space-y-1.5 text-sm">
      <li className="font-medium">{client.name}</li>
      {client.phones.map((phone) => (
        <li key={phone}>
          <a href={telHref(phone)} className="flex items-center gap-2 tabular-nums hover:text-primary">
            <Phone className="size-3.5 text-muted-foreground" aria-hidden />
            {phone}
          </a>
        </li>
      ))}
      {client.email && (
        <li>
          <a href={`mailto:${client.email}`} className="flex items-center gap-2 hover:text-primary">
            <Mail className="size-3.5 text-muted-foreground" aria-hidden />
            {client.email}
          </a>
        </li>
      )}
      {client.city && (
        <li className="flex items-center gap-2">
          <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
          {client.city}
        </li>
      )}
      {client.phones.length === 0 && !client.email && (
        <li className="text-meta text-muted-foreground">Контакты не указаны</li>
      )}
    </ul>
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
