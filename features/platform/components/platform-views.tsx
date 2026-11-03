import Link from "next/link"
import { AlertTriangle, Building2, CircleDollarSign, Inbox, Plus, Users } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterSelect } from "@/components/shared/filter-select"
import { ListPanel } from "@/components/shared/list-panel"
import { PageHeader } from "@/components/shared/page-header"
import { PaginationNav } from "@/components/shared/pagination-nav"
import { SearchInput } from "@/components/shared/search-input"
import { SegmentedLinks } from "@/components/shared/segmented-links"
import { StatusBadge } from "@/components/shared/status-badge"
import { Toolbar } from "@/components/shared/toolbar"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { platformCompanyRoute, platformTicketRoute, routes } from "@/config/routes"
import * as platform from "@/features/platform/api/platform-repository"
import { CompanyCreateForm } from "@/features/platform/components/company-create-form"
import { CompanyLimitsEditor } from "@/features/platform/components/company-limits-editor"
import { CompanyActiveControl, CompanyNameForm, ErrorStatusControl, SubscriptionForm, TicketUpdateForm } from "@/features/platform/components/platform-controls"
import { DirectorCredentialsButton } from "@/features/platform/components/director-credentials-button"
import type { PlatformSection } from "@/features/platform/components/platform-nav"
import { ACCESS_META, ERROR_STATUS_META, FEATURE_LABELS, HISTORY_LABELS, PLAN_LABELS, TICKET_KIND_LABELS, TICKET_STATUS_META } from "@/features/platform/labels"
import {
  ACCESS_STATES,
  ERROR_STATUSES,
  PLAN_CODES,
  TICKET_STATUSES,
  type CompanyFilters,
  type CompanySummary,
  type ErrorStatus,
  type Overview,
  type TicketStatus,
} from "@/features/platform/schemas"
import { tryLoad } from "@/lib/api/load"
import { pageInfo, pageParams } from "@/lib/api/pagination"
import { getRenderAuth } from "@/lib/auth/token-store"
import { nowIso } from "@/lib/clock"
import { companyDateOf } from "@/lib/datetime"
import { formatDateTime, formatDecimalMoney, formatFullDate, formatNumber } from "@/lib/format"
import { applyParamPatch, getPageParam, getParam, toUrlSearchParams, type SearchParamsRecord } from "@/lib/search-params"

const PAGE_SIZE = 25

/** Обёртка раздела: заголовок и честное сообщение для демо-режима. Разделы панели — в верхнем меню */
function PlatformPage({ title, description, actions, children }: { section: PlatformSection; title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} actions={actions} />
      {isMockDataSource ? (
        <ListPanel>
          <EmptyState
            icon={Building2}
            title="Панель платформы работает только с сервером"
            description="В демо-режиме реестра компаний, подписок и обращений нет. Запустите интерфейс с NEXT_PUBLIC_DATA_SOURCE=api."
          />
        </ListPanel>
      ) : (
        children
      )}
    </div>
  )
}

function hrefWith(base: string, params: SearchParamsRecord, patch: Record<string, string | null>): string {
  const query = applyParamPatch(toUrlSearchParams(params), patch).toString()
  return query ? `${base}?${query}` : base
}

// --- обзор ------------------------------------------------------------------------------

const PERIODS = [
  { days: 7, label: "7 дней" },
  { days: 30, label: "30 дней" },
  { days: 90, label: "90 дней" },
  { days: 365, label: "Год" },
] as const

export async function PlatformOverviewView({ params }: { params: SearchParamsRecord }) {
  const requested = Number(getParam(params, "period") ?? "30")
  const days = PERIODS.some((p) => p.days === requested) ? requested : 30
  return (
    <PlatformPage
      section="overview"
      title="Администратор платформы"
      description="Подключённые компании, подписки и состояние платформы"
      actions={
        <Link href={routes.platformCompanyNew} className={buttonVariants({ size: "lg" })}>
          <Plus data-icon="inline-start" aria-hidden />
          Подключить компанию
        </Link>
      }
    >
      <OverviewContent days={days} params={params} />
    </PlatformPage>
  )
}

async function OverviewContent({ days, params }: { days: number; params: SearchParamsRecord }) {
  const loaded = await tryLoad(async () => platform.getOverview(await getRenderAuth(), days))
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const o = loaded.data
  return (
    <div className="space-y-5">
      <SegmentedLinks
        label="Период"
        variant="pill"
        className="w-fit"
        items={PERIODS.map((p) => ({ key: String(p.days), label: p.label, href: hrefWith(routes.platform, params, { period: String(p.days) }), isActive: p.days === days }))}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Building2} label="Компаний всего" value={o.companies.total} note={`${formatNumber(o.companies.active)} активны · ${formatNumber(o.companies.suspended)} приостановлены`} />
        <Stat icon={Building2} label="Подключено за период" value={o.companies.newInPeriod} />
        <Stat icon={Users} label="Пользователей" value={o.users.active} note="Активные аккаунты в активных компаниях" />
        <Stat icon={CircleDollarSign} label="Подписок дают доступ" value={o.subscriptions.givingAccess} />
      </div>

      <section className="grid gap-3 lg:grid-cols-2">
        <Panel title="Подписки">
          <dl className="divide-y text-sm">
            {(["active", "expiring", "expired", "pastDue", "cancelled"] as const).map((key) => {
              const state = key === "pastDue" ? "past_due" : key
              const filterHref = `${routes.platformCompanies}?access=${state}`
              return (
                <div key={key} className="flex items-center justify-between gap-3 py-2">
                  <dt>
                    <StatusBadge tone={ACCESS_META[state].tone}>{ACCESS_META[state].label}</StatusBadge>
                  </dt>
                  <dd>
                    <Link href={filterHref} className="font-medium tabular-nums hover:text-primary">
                      {formatNumber(o.subscriptions[key])}
                    </Link>
                  </dd>
                </div>
              )
            })}
            <div className="flex items-center justify-between gap-3 py-2 text-muted-foreground">
              <dt>Без подписки</dt>
              <dd className="tabular-nums">{formatNumber(o.subscriptions.none)}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Выручка">
          <Revenue overview={o} />
        </Panel>

        <Panel title="Технические ошибки">
          <p className="text-sm">
            <Link href={`${routes.platformErrors}?status=new`} className="font-semibold tabular-nums hover:text-primary">
              {formatNumber(o.errors.new)}
            </Link>{" "}
            новых · {formatNumber(o.errors.inPeriod)} за период
          </p>
          <p className="text-meta text-muted-foreground">Непредвиденные ошибки сервера (HTTP 500) — без текста ошибки и данных запроса.</p>
        </Panel>

        <Panel title="Обращения компаний">
          <p className="text-sm">
            <Link href={routes.platformTickets} className="font-semibold tabular-nums hover:text-primary">
              {formatNumber(o.tickets.open)}
            </Link>{" "}
            открытых · {formatNumber(o.tickets.inPeriod)} за период
          </p>
        </Panel>
      </section>
    </div>
  )
}

function Revenue({ overview }: { overview: Overview }) {
  const { revenue } = overview
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs text-muted-foreground">Сумма назначенных тарифов в месяц</p>
        <p className="font-semibold tabular-nums">
          {revenue.assignedMonthly.length ? revenue.assignedMonthly.map((m) => formatDecimalMoney(m.amount, m.currency)).join(" · ") : "0"}
        </p>
        <p className="text-xs text-muted-foreground">По прейскуранту действующих подписок. Это не полученные деньги.</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Получено оплат за период</p>
        <p className="font-medium text-muted-foreground">Нет данных</p>
        <p className="text-xs text-muted-foreground">
          Платежи за подписки на платформе пока не учитываются. Для показателя нужен учёт оплат (вручную или от платёжного провайдера).
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Просроченные платежи</p>
        <p className="font-medium text-muted-foreground">Нет данных</p>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, note }: { icon: typeof Building2; label: string; value: number; note?: string }) {
  return (
    <div className="space-y-1 rounded-xl bg-card p-4 ring-1 ring-border">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums">{formatNumber(value)}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-border">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

// --- компании -----------------------------------------------------------------------------

function companyFilters(params: SearchParamsRecord): CompanyFilters {
  const status = getParam(params, "status")
  const plan = getParam(params, "plan")
  const access = getParam(params, "access")
  return {
    search: getParam(params, "q"),
    status: status === "active" || status === "suspended" ? status : null,
    plan: PLAN_CODES.find((code) => code === plan) ?? null,
    access: ACCESS_STATES.find((state) => state === access) ?? null,
  }
}

export async function PlatformCompaniesView({ params }: { params: SearchParamsRecord }) {
  return (
    <PlatformPage
      section="companies"
      title="Компании"
      description="Реестр подключённых компаний, тарифы и сроки подписок"
      actions={
        <Link href={routes.platformCompanyNew} className={buttonVariants({ size: "lg" })}>
          <Plus data-icon="inline-start" aria-hidden />
          Подключить компанию
        </Link>
      }
    >
      <Toolbar>
        <SearchInput label="Поиск компании" placeholder="Название или короткое имя" />
        <FilterSelect label="Статус" param="status" allLabel="Любой статус" options={[{ value: "active", label: "Активные" }, { value: "suspended", label: "Приостановлены" }]} />
        <FilterSelect label="Тариф" param="plan" allLabel="Любой тариф" options={PLAN_CODES.map((code) => ({ value: code, label: PLAN_LABELS[code] }))} />
        <FilterSelect label="Подписка" param="access" allLabel="Любая подписка" options={ACCESS_STATES.map((state) => ({ value: state, label: ACCESS_META[state].label }))} />
      </Toolbar>
      <CompaniesTable params={params} />
    </PlatformPage>
  )
}

async function CompaniesTable({ params }: { params: SearchParamsRecord }) {
  const page = pageParams(getPageParam(params), PAGE_SIZE)
  const loaded = await tryLoad(async () => platform.listCompanies(await getRenderAuth(), companyFilters(params), page))
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const { count, results } = loaded.data
  if (results.length === 0) {
    return (
      <ListPanel>
        <EmptyState icon={Building2} title="Компаний не найдено" description="Измените фильтры или подключите новую компанию." />
      </ListPanel>
    )
  }
  return (
    <div className="space-y-3">
      <ListPanel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="text-left text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
              <tr>
                <th scope="col" className="h-9 px-4 font-medium">Компания</th>
                <th scope="col" className="h-9 px-3 font-medium">Статус</th>
                <th scope="col" className="h-9 px-3 font-medium">Тариф и модули</th>
                <th scope="col" className="h-9 px-3 font-medium">Подписка</th>
                <th scope="col" className="h-9 px-3 text-right font-medium">Сотрудники</th>
                <th scope="col" className="h-9 px-4 text-right font-medium">Подключена</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.map((company) => (
                <CompanyRow key={company.id} company={company} />
              ))}
            </tbody>
          </table>
        </div>
      </ListPanel>
      <PaginationNav info={pageInfo(count, page)} hrefForPage={(n) => hrefWith(routes.platformCompanies, params, { page: n > 1 ? String(n) : null })} />
    </div>
  )
}

function CompanyRow({ company }: { company: CompanySummary }) {
  const sub = company.subscription
  return (
    <tr>
      <td className="px-4 py-2.5">
        <Link href={platformCompanyRoute(company.id)} className="font-medium hover:text-primary">
          {company.name}
        </Link>
        <p className="font-mono text-xs text-muted-foreground">{company.slug}</p>
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge tone={company.isActive ? "success" : "neutral"}>{company.isActive ? "Активна" : "Приостановлена"}</StatusBadge>
      </td>
      <td className="px-3 py-2.5 text-meta">
        {sub ? (
          <>
            {PLAN_LABELS[sub.planCode]}
            <span className="block text-xs text-muted-foreground">
              {sub.features === null ? "Все модули" : sub.features.length ? sub.features.map((f) => FEATURE_LABELS[f]).join(", ") : "Только основа CRM"}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Не назначен</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-meta">
        {sub ? (
          <>
            <StatusBadge tone={ACCESS_META[sub.accessState].tone}>{ACCESS_META[sub.accessState].label}</StatusBadge>
            <span className="block text-xs text-muted-foreground">
              {formatFullDate(sub.startsOn)} — {sub.endsOn ? formatFullDate(sub.endsOn) : "бессрочно"}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="tabular-nums">{formatNumber(company.staff?.employees ?? company.users)}</span>
        {company.staff && (
          <span className="block text-xs whitespace-nowrap text-muted-foreground tabular-nums">
            {formatNumber(company.staff.departments)} отд. · {formatNumber(company.staff.headsOfSales)} РОП · {formatNumber(company.staff.managers)} мен.
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right text-meta text-muted-foreground">{formatFullDate(company.createdAt)}</td>
    </tr>
  )
}

// --- ошибки -------------------------------------------------------------------------------

export async function PlatformErrorsView({ params }: { params: SearchParamsRecord }) {
  const statusParam = getParam(params, "status")
  const status: ErrorStatus | null = ERROR_STATUSES.find((s) => s === statusParam) ?? null
  return (
    <PlatformPage section="errors" title="Ошибки платформы" description="Непредвиденные ошибки сервера, влияющие на работу CRM">
      <SegmentedLinks
        label="Статус"
        variant="pill"
        className="w-fit"
        items={[null, ...ERROR_STATUSES].map((s) => ({
          key: s ?? "all",
          label: s ? ERROR_STATUS_META[s].label : "Все",
          href: hrefWith(routes.platformErrors, params, { status: s }),
          isActive: s === status,
        }))}
      />
      <ErrorsTable params={params} status={status} />
      <p className="text-meta text-muted-foreground">
        Записываются только место и тип ошибки. Текст ошибки, данные запроса и пароли не сохраняются — подробности ищите в серверных логах по коду запроса.
      </p>
    </PlatformPage>
  )
}

async function ErrorsTable({ params, status }: { params: SearchParamsRecord; status: ErrorStatus | null }) {
  const page = pageParams(getPageParam(params), PAGE_SIZE)
  const loaded = await tryLoad(async () => platform.listErrors(await getRenderAuth(), status, page))
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const { count, results } = loaded.data
  if (results.length === 0) {
    return (
      <ListPanel>
        <EmptyState icon={AlertTriangle} title="Ошибок нет" description="Непредвиденных ошибок сервера с такими условиями не зарегистрировано." />
      </ListPanel>
    )
  }
  return (
    <div className="space-y-3">
      <ListPanel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="text-left text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
              <tr>
                <th scope="col" className="h-9 px-4 font-medium">Когда</th>
                <th scope="col" className="h-9 px-3 font-medium">Компонент и запрос</th>
                <th scope="col" className="h-9 px-3 font-medium">Ошибка</th>
                <th scope="col" className="h-9 px-3 font-medium">Компания</th>
                <th scope="col" className="h-9 px-4 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.map((error) => (
                <tr key={error.id}>
                  <td className="px-4 py-2.5 text-meta whitespace-nowrap">{formatDateTime(error.occurredAt)}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{error.component.replace(/^modules\./, "")}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {error.method} /{error.route}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-mono text-xs">{error.exceptionType}</p>
                    {error.requestId && <p className="font-mono text-xs text-muted-foreground select-all">{error.requestId}</p>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{error.tenantSlug ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <ErrorStatusControl errorId={error.id} status={error.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListPanel>
      <PaginationNav info={pageInfo(count, page)} hrefForPage={(n) => hrefWith(routes.platformErrors, params, { page: n > 1 ? String(n) : null })} />
    </div>
  )
}

// --- обращения ----------------------------------------------------------------------------

export async function PlatformTicketsView({ params }: { params: SearchParamsRecord }) {
  const statusParam = getParam(params, "status")
  const status: TicketStatus | null = TICKET_STATUSES.find((s) => s === statusParam) ?? null
  return (
    <PlatformPage section="tickets" title="Обращения компаний" description="Вопросы, проблемы и отзывы, отправленные сотрудниками компаний">
      <SegmentedLinks
        label="Статус"
        variant="pill"
        className="w-fit"
        items={[null, ...TICKET_STATUSES].map((s) => ({
          key: s ?? "all",
          label: s ? TICKET_STATUS_META[s].label : "Все",
          href: hrefWith(routes.platformTickets, params, { status: s }),
          isActive: s === status,
        }))}
      />
      <TicketsTable params={params} status={status} />
    </PlatformPage>
  )
}

async function TicketsTable({ params, status }: { params: SearchParamsRecord; status: TicketStatus | null }) {
  const page = pageParams(getPageParam(params), PAGE_SIZE)
  const loaded = await tryLoad(async () => platform.listTickets(await getRenderAuth(), status, page))
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  const { count, results } = loaded.data
  if (results.length === 0) {
    return (
      <ListPanel>
        <EmptyState icon={Inbox} title="Обращений нет" description="Компании ещё не отправляли обращений с таким статусом." />
      </ListPanel>
    )
  }
  return (
    <div className="space-y-3">
      <ListPanel>
        <ul className="divide-y">
          {results.map((ticket) => (
            <li key={ticket.id}>
              <Link href={platformTicketRoute(ticket.id)} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 hover:bg-muted/40">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">{ticket.subject}</p>
                  <p className="text-meta text-muted-foreground">
                    {TICKET_KIND_LABELS[ticket.kind]} · {ticket.company.name} · {ticket.author.name}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-meta text-muted-foreground">
                  {formatDateTime(ticket.createdAt)}
                  <StatusBadge tone={TICKET_STATUS_META[ticket.status].tone}>{TICKET_STATUS_META[ticket.status].label}</StatusBadge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </ListPanel>
      <PaginationNav info={pageInfo(count, page)} hrefForPage={(n) => hrefWith(routes.platformTickets, params, { page: n > 1 ? String(n) : null })} />
    </div>
  )
}

export function PlatformSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-9 w-96" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

// --- подключение и карточка компании -----------------------------------------------------

export async function PlatformCompanyNewView() {
  return (
    <PlatformPage section="companies" title="Подключить компанию" description="Компания, её отдельная база данных, директор и подписка создаются одной операцией">
      <CompanyNewContent />
    </PlatformPage>
  )
}

async function CompanyNewContent() {
  const loaded = await tryLoad(async () => platform.getCatalog(await getRenderAuth()))
  if (!loaded.ok) return <ApiErrorState error={loaded.error} />
  return (
    <div className="max-w-3xl">
      <CompanyCreateForm catalog={loaded.data} today={companyDateOf(nowIso())} />
    </div>
  )
}

export async function PlatformCompanyView({ companyId }: { companyId: string }) {
  const loaded = await tryLoad(async () => {
    const auth = await getRenderAuth()
    return Promise.all([platform.getCompany(auth, companyId), platform.getCatalog(auth)])
  })
  // Лимиты — отдельно: их ошибка не должна закрывать всю карточку компании
  const limits = await tryLoad(async () => platform.getCompanyLimits(await getRenderAuth(), companyId))
  if (!loaded.ok) {
    return (
      <PlatformPage section="companies" title="Компания">
        <ApiErrorState error={loaded.error} />
      </PlatformPage>
    )
  }
  const [company, catalog] = loaded.data
  const sub = company.subscription
  return (
    <PlatformPage
      section="companies"
      title={company.name}
      description={`${company.slug} · подключена ${formatFullDate(company.createdAt)}`}
      actions={<CompanyActiveControl companyId={company.id} isActive={company.isActive} name={company.name} />}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Panel title="Подписка">
            {sub ? (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge tone={ACCESS_META[sub.accessState].tone}>{ACCESS_META[sub.accessState].label}</StatusBadge>
                {PLAN_LABELS[sub.planCode]} · {formatFullDate(sub.startsOn)} — {sub.endsOn ? formatFullDate(sub.endsOn) : "бессрочно"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Подписка не назначена: компания работает без ограничений модулей и срока.</p>
            )}
            <SubscriptionForm companyId={company.id} subscription={sub} catalog={catalog} today={companyDateOf(nowIso())} />
          </Panel>

          {sub && (
            <Panel title="Лимиты">
              {limits.ok ? (
                <CompanyLimitsEditor key={JSON.stringify(limits.data)} companyId={company.id} metrics={limits.data} />
              ) : (
                <ApiErrorState error={limits.error} bare />
              )}
            </Panel>
          )}

          <Panel title="История изменений">
            {company.history.length === 0 ? (
              <p className="text-meta text-muted-foreground">Изменений платформой не было.</p>
            ) : (
              <ol className="divide-y text-sm">
                {company.history.map((entry) => (
                  <li key={`${entry.occurredAt}-${entry.action}`} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>{HISTORY_LABELS[entry.action] ?? entry.action}</span>
                    <span className="text-meta text-muted-foreground">
                      {formatDateTime(entry.occurredAt)}
                      {entry.actor && ` · ${entry.actor}`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Сведения">
            <dl className="space-y-1.5 text-sm">
              <Row label="Статус">
                <StatusBadge tone={company.isActive ? "success" : "neutral"}>{company.isActive ? "Активна" : "Приостановлена"}</StatusBadge>
              </Row>
              <Row label="База данных">{company.tenantStatus === "active" ? "Готова" : (company.tenantStatus ?? "Не создана")}</Row>
              <Row label="Сотрудников (действующих)">{formatNumber(company.staff?.employees ?? company.users)}</Row>
              {company.staff && <Row label="Руководителей компании">{formatNumber(company.staff.leaders)}</Row>}
              <Row label="Отделов продаж">{formatNumber(company.staff?.departments ?? company.departments)}</Row>
              {company.staff && <Row label="РОПов">{formatNumber(company.staff.headsOfSales)}</Row>}
              {company.staff && <Row label="Менеджеров">{formatNumber(company.staff.managers)}</Row>}
              <Row label="Страна и валюта">
                {company.country} · {company.currency}
              </Row>
              <Row label="Часовой пояс">{company.timezone}</Row>
            </dl>
            <CompanyNameForm companyId={company.id} name={company.name} />
          </Panel>

          <Panel title="Директор">
            {company.directors.length === 0 ? (
              <p className="text-meta text-muted-foreground">Директор не назначен.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {company.directors.map((director) => (
                  <li key={director.userId}>
                    <p className="font-medium">{director.fullName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{director.login}</p>
                    <p className="text-xs text-muted-foreground">
                      {director.status === "invited"
                        ? "Ещё не входил"
                        : director.status === "deactivated"
                          ? "Отключён"
                          : director.lastLogin
                            ? `Последний вход ${formatDateTime(director.lastLogin)}`
                            : "Активен"}
                    </p>
                    {director.status !== "deactivated" && (
                      <div className="pt-1.5">
                        <DirectorCredentialsButton companyId={company.id} companyName={company.name} director={director} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </PlatformPage>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

export async function PlatformTicketView({ ticketId }: { ticketId: string }) {
  const loaded = await tryLoad(async () => platform.getTicket(await getRenderAuth(), ticketId))
  if (!loaded.ok) {
    return (
      <PlatformPage section="tickets" title="Обращение">
        <ApiErrorState error={loaded.error} />
      </PlatformPage>
    )
  }
  const ticket = loaded.data
  return (
    <PlatformPage section="tickets" title={ticket.subject} description={`${TICKET_KIND_LABELS[ticket.kind]} · ${ticket.company.name} · ${ticket.author.name}`}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel title="Текст обращения">
          <p className="text-meta text-muted-foreground">{formatDateTime(ticket.createdAt)}</p>
          <p className="text-sm whitespace-pre-wrap">{ticket.body}</p>
        </Panel>
        <Panel title="Обработка">
          <TicketUpdateForm ticketId={ticket.id} status={ticket.status} internalNote={ticket.internalNote ?? ""} />
        </Panel>
      </div>
      <Link href={routes.platformTickets} className={buttonVariants({ variant: "ghost" })}>
        ← Все обращения
      </Link>
    </PlatformPage>
  )
}
