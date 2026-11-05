import Link from "next/link"
import { CheckCircle2, ChevronDown, Mic } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { MetricHint } from "@/components/shared/metric-hint"
import { routes } from "@/config/routes"
import { PaymentReviewView } from "@/features/payments/components/payment-review-view"
import { fetchTodayActions, TODAY_ACTIONS_LIMIT_MAX, type TodayActionGroup } from "@/features/team-cabinet/api/today-actions"
import { CabinetSection } from "@/features/team-cabinet/components/cabinet-parts"
import { groupByManager, todayItemHref, todayItemMeta } from "@/features/team-cabinet/lib/today-actions"
import { tryLoad } from "@/lib/api/load"
import { formatDecimalMoney, formatNumber, formatTime } from "@/lib/format"
import { hrefWithParams, type SearchParamsRecord } from "@/lib/search-params"
import { cn } from "@/lib/utils"

/** Виджеты «Что делать сегодня»; открытый виджет — в адресе (`?focus=`), список — под виджетами */
export const TODAY_WIDGETS = ["payments", "overdue", "today", "misses"] as const
export type TodayWidget = (typeof TODAY_WIDGETS)[number]

/** Из чего собран виджет «Задачи: сегодня и завтра» — промахи менеджеров по правилам backend */
const TODAY_KINDS = ["tasks_due_soon", "deals_without_next_step", "leads_without_contact", "meetings_without_outcome", "deals_to_push"] as const

const TODAY_RULE =
  "Задачи со сроком сегодня и завтра, сделки без следующего шага, необработанные лиды, встречи без итога и сделки на дожим — по каждому менеджеру. Правила и пороги считает сервер."

const MISSES_RULE =
  "Ошибки менеджеров в разговорах с клиентами: ИИ слушает звонки, оценивает их и собирает слабые места каждого менеджера для one-to-one. Появится после подключения телефонии и ИИ-оценки звонков."

/**
 * «Что делать сегодня» — верх кабинета РОПа и директора. Четыре виджета; по нажатию под ними
 * раскрывается полный список, сгруппированный по менеджерам. Только правила backend.
 */
export async function TodayActionsSection({ focus, params }: { focus: TodayWidget | null; params: SearchParamsRecord }) {
  // Развёрнутому списку нужны все строки групп (до максимума backend), свёрнутым виджетам — только счётчики
  const result = await tryLoad(() => fetchTodayActions(null, focus ? TODAY_ACTIONS_LIMIT_MAX : 1))
  if (!result.ok) {
    return (
      <CabinetSection id="today-actions" title="Что делать сегодня">
        <ApiErrorState error={result.error} bare />
      </CabinetSection>
    )
  }
  const actions = result.data
  const group = (kind: string) => actions.groups.find((g) => g.kind === kind) ?? null
  const payments = group("payments_to_verify")
  const overdue = group("overdue_tasks")
  const todayGroups = TODAY_KINDS.map(group).filter((g): g is TodayActionGroup => g !== null)
  const todayCount = todayGroups.reduce((sum, g) => sum + g.count, 0)
  const href = (widget: TodayWidget) => hrefWithParams(routes.team, params, { focus: widget === focus ? null : widget })

  return (
    <CabinetSection id="today-actions" title="Что делать сегодня" description={`Данные на ${formatTime(actions.asOf)} · нажмите на виджет, чтобы открыть список`}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <WidgetCard
          title="Оплаты ждут проверки"
          rule={payments?.rule ?? "Оплаты с чеком, которые менеджер отправил на проверку."}
          count={payments?.count ?? 0}
          urgent
          note={payments && payments.amounts.length > 0 ? `Сумма: ${payments.amounts.map((row) => formatDecimalMoney(row.total, row.currency)).join(" · ")}` : null}
          href={href("payments")}
          isOpen={focus === "payments"}
        />
        <WidgetCard
          title="Просроченные задачи"
          rule={overdue?.rule ?? "Открытые задачи со сроком раньше сегодняшнего дня."}
          count={overdue?.count ?? 0}
          urgent
          note={overdue && overdue.byManager.length > 0 ? `У менеджеров: ${formatNumber(overdue.byManager.length)}` : null}
          href={href("overdue")}
          isOpen={focus === "overdue"}
        />
        <WidgetCard
          title="Задачи: сегодня и завтра"
          rule={TODAY_RULE}
          count={todayCount}
          note={todayCount > 0 ? todayGroups.filter((g) => g.count > 0).map((g) => `${shortTitle(g.kind)} ${formatNumber(g.count)}`).join(" · ") : null}
          href={href("today")}
          isOpen={focus === "today"}
        />
        <WidgetCard title="Проколы менеджеров" rule={MISSES_RULE} count={null} note="Для one-to-one: ошибки в звонках по оценке ИИ" href={href("misses")} isOpen={focus === "misses"} />
      </div>

      {focus === "payments" && (
        <DrillDown title="Оплаты ждут проверки" closeHref={href("payments")}>
          <PaymentReviewView />
        </DrillDown>
      )}
      {focus === "overdue" && (
        <DrillDown title="Просроченные задачи по менеджерам" closeHref={href("overdue")}>
          <ByManager groups={overdue ? [overdue] : []} today={actions.date} showGroupTitles={false} empty="Просроченных задач нет." />
        </DrillDown>
      )}
      {focus === "today" && (
        <DrillDown title="Задачи на сегодня и завтра по менеджерам" closeHref={href("today")}>
          <ByManager groups={todayGroups} today={actions.date} showGroupTitles empty="На сегодня и завтра всё в порядке." />
        </DrillDown>
      )}
      {focus === "misses" && (
        <DrillDown title="Проколы менеджеров" closeHref={href("misses")}>
          <div className="flex items-start gap-3 text-sm">
            <Mic className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="space-y-1">
              <p>Здесь будут ошибки каждого менеджера по оценке звонков: сколько звонков оценено и на сколько баллов, что упущено — не назначил дату, не спросил имя, не выявил потребность.</p>
              <p className="text-muted-foreground">Данных пока нет: оценка появится после подключения телефонии и ИИ-анализа разговоров.</p>
            </div>
          </div>
        </DrillDown>
      )}
    </CabinetSection>
  )
}

/** Короткие подписи групп для строки-сводки виджета */
function shortTitle(kind: string): string {
  switch (kind) {
    case "tasks_due_soon":
      return "задачи"
    case "deals_without_next_step":
      return "без шага"
    case "leads_without_contact":
      return "лиды"
    case "meetings_without_outcome":
      return "без итога"
    case "deals_to_push":
      return "дожим"
    default:
      return kind
  }
}

function WidgetCard({
  title,
  rule,
  count,
  urgent = false,
  note,
  href,
  isOpen,
}: {
  title: string
  rule: string
  count: number | null
  urgent?: boolean
  note: string | null
  href: string
  isOpen: boolean
}) {
  const tone = count === null || count === 0 ? "text-muted-foreground" : urgent ? "text-destructive" : "text-warning"
  return (
    <div className={cn("relative flex h-full flex-col gap-2 rounded-xl px-3 py-2.5 ring-1 ring-border transition-colors hover:bg-muted/40", isOpen && "bg-muted/50 ring-primary/60")}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="inline-flex items-center gap-1 text-sm font-medium">
          {/* Вся карточка — ссылка; подсказка остаётся отдельной кнопкой поверх */}
          <Link href={href} scroll={false} aria-expanded={isOpen} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none">
            {title}
          </Link>
          <span className="relative z-10">
            <MetricHint label={title} definition={rule} />
          </span>
        </h3>
        <span className={cn("text-lg font-semibold tabular-nums", tone)}>{count === null ? "—" : formatNumber(count)}</span>
      </div>
      {count === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" aria-hidden />
          Всё в порядке
        </p>
      ) : (
        note && <p className="text-meta text-muted-foreground">{note}</p>
      )}
      <p className="mt-auto inline-flex items-center gap-1 text-xs text-primary">
        {isOpen ? "Свернуть" : "Открыть список"}
        <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} aria-hidden />
      </p>
    </div>
  )
}

function DrillDown({ title, closeHref, children }: { title: string; closeHref: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3 rounded-xl px-4 py-3 ring-1 ring-primary/40">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Link href={closeHref} scroll={false} className="text-xs text-muted-foreground hover:text-foreground">
          Свернуть
        </Link>
      </div>
      {children}
    </section>
  )
}

function ByManager({ groups, today, showGroupTitles, empty }: { groups: readonly TodayActionGroup[]; today: string; showGroupTitles: boolean; empty: string }) {
  const blocks = groupByManager(groups)
  if (blocks.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  const truncated = groups.filter((g) => g.count > g.items.length)
  return (
    <div className="space-y-3">
      <ol className="grid gap-3 lg:grid-cols-2">
        {blocks.map((block) => (
          <li key={block.id} className="space-y-2 rounded-lg bg-muted/30 px-3 py-2.5">
            <p className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{block.name}</span>
              <span className="text-meta text-muted-foreground tabular-nums">{formatNumber(block.total)}</span>
            </p>
            {block.groups.map(({ group, items }) => (
              <div key={group.kind} className="space-y-1">
                {showGroupTitles && (
                  <p className="text-xs font-medium text-muted-foreground">
                    {group.title} · {formatNumber(items.length)}
                  </p>
                )}
                <ul className="space-y-1">
                  {items.map((item) => {
                    const href = todayItemHref(group.kind, item)
                    const title = item.title || "Без названия"
                    return (
                      <li key={item.id} className="text-sm leading-snug">
                        {href ? (
                          <Link href={href} className="hover:text-primary hover:underline">
                            {title}
                          </Link>
                        ) : (
                          title
                        )}
                        <span className="block text-xs text-muted-foreground">{todayItemMeta(group.kind, item, today).join(" · ")}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </li>
        ))}
      </ol>
      {truncated.length > 0 && (
        <p className="text-meta text-muted-foreground">
          Показаны первые {formatNumber(TODAY_ACTIONS_LIMIT_MAX)} строк в группах: {truncated.map((g) => `${g.title} (всего ${formatNumber(g.count)})`).join(", ")}.
        </p>
      )}
    </div>
  )
}
