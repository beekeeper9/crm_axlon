import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  ListChecks,
  MessageSquare,
  NotebookPen,
  Phone,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { leadsRepository } from "@/features/leads/api/leads-repository"
import type { ActivityKind, LeadDetail } from "@/features/leads/schemas"
import { formatDateTime, formatDayMonth, formatDecimalMoney } from "@/lib/format"

/**
 * «Сейчас по сделке»: следующий шаг и контекст ИИ в одной панели — первое, что видит менеджер.
 * Следующий шаг — главный ориентир; сводка ИИ помогает понять, почему он такой.
 */
export function LeadNowPanel({ lead, isDemoData }: { lead: LeadDetail; isDemoData: boolean }) {
  const next = lead.nextAction
  const ai = lead.aiContext
  return (
    <section aria-labelledby="lead-now" className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <h2 id="lead-now" className="sr-only">Сейчас по сделке</h2>
      <div
        className={cn(
          "flex items-start gap-3 px-4 py-3",
          !next ? "bg-warning/8" : next.isOverdue ? "bg-destructive/8" : undefined
        )}
      >
        <CalendarClock
          className={cn("mt-0.5 size-4 shrink-0", next?.isOverdue ? "text-destructive" : next ? "text-primary" : "text-warning")}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Следующий шаг</p>
          {next ? (
            <p className="font-medium">
              {next.title}
              {next.dueAt && (
                <span className={cn("ml-2 text-meta font-normal tabular-nums", next.isOverdue ? "text-destructive" : "text-muted-foreground")}>
                  {next.isOverdue && "просрочен · "}
                  {formatDateTime(next.dueAt)}
                </span>
              )}
            </p>
          ) : (
            <p className="font-medium text-warning">Не назначен — поставьте задачу или встречу во вкладке «Работа»</p>
          )}
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" aria-hidden />
            Что по сделке?
          </p>
          {ai && (
            <span className="text-xs text-muted-foreground">
              {isDemoData ? "пример текста · демо" : `обновлено ${formatDateTime(ai.generatedAt)}`}
            </span>
          )}
        </div>
        {ai ? (
          <div className="space-y-2">
            <p className="text-sm leading-relaxed text-foreground/90">{ai.summary}</p>
            {ai.nextSteps.length > 0 && (
              <ul className="space-y-1">
                {ai.nextSteps.map((step) => (
                  <li key={step} className="flex items-start gap-2 text-meta text-muted-foreground">
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary/80" aria-hidden />
                    {step}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-meta text-muted-foreground">
            Сводка появится, когда по лиду накопятся звонки, переписка или встречи и будет подключён ИИ-сервис.
          </p>
        )}
      </div>
    </section>
  )
}

const ACTIVITY_META: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  call: { icon: Phone, tone: "bg-info/15 text-info" },
  chat: { icon: MessageSquare, tone: "bg-chart-2/15 text-chart-2" },
  note: { icon: NotebookPen, tone: "bg-muted text-muted-foreground" },
  stage: { icon: Workflow, tone: "bg-primary/15 text-primary" },
  task: { icon: ListChecks, tone: "bg-muted text-muted-foreground" },
  meeting: { icon: Users, tone: "bg-chart-4/15 text-chart-4" },
  payment: { icon: CircleDollarSign, tone: "bg-success/15 text-success" },
}

export async function LeadTimeline({ leadId }: { leadId: string }) {
  const activity = await leadsRepository.getActivity(leadId)
  if (activity.length === 0) {
    return <EmptyState icon={NotebookPen} title="Событий пока нет" description="Здесь появятся звонки, сообщения, встречи и смены этапов." />
  }
  return (
    <ol className="relative space-y-4 before:absolute before:inset-y-1 before:left-3.5 before:w-px before:bg-border">
      {activity.map((item) => {
        const meta = ACTIVITY_META[item.kind]
        return (
          <li key={item.id} className="relative flex gap-3">
            <span className={cn("relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-background", meta.tone)}>
              <meta.icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium">{item.title}</span>
                <time dateTime={item.at} className="text-xs text-muted-foreground">
                  {formatDateTime(item.at)}
                </time>
              </p>
              {item.body && <p className="mt-0.5 text-sm text-foreground/85">{item.body}</p>}
              {item.author && <p className="mt-0.5 text-xs text-muted-foreground">{item.author}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

const PAYMENT_KIND_LABELS = { prepayment: "Предоплата", additional: "Доплата", full: "Полная оплата" } as const

export function LeadPayment({ lead }: { lead: LeadDetail }) {
  const payment = lead.payment
  if (!payment) {
    return <EmptyState icon={CircleDollarSign} title="Оплат пока нет" description="Предоплаты и доплаты появятся здесь после поступления денег." />
  }
  const money = (amount: string) => formatDecimalMoney(amount, payment.currency)
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Сумма сделки", value: money(payment.total) },
          { label: "Оплачено", value: money(payment.paid), className: "text-success" },
          { label: "Осталось", value: money(payment.remaining), className: payment.remaining === "0.00" ? undefined : "text-warning" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className={cn("text-lg font-semibold tabular-nums", item.className)}>{item.value}</dd>
          </div>
        ))}
      </dl>
      <ul className="divide-y rounded-lg border">
        {payment.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2">
              <StatusBadge tone="success">{PAYMENT_KIND_LABELS[item.kind]}</StatusBadge>
              <span className="text-muted-foreground">{formatDayMonth(item.paidDate)}</span>
            </span>
            <span className="font-medium tabular-nums">{money(item.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LeadFields({ lead }: { lead: LeadDetail }) {
  const rows: { label: string; value: string | null }[] = [
    { label: "Имя клиента", value: lead.client.name },
    { label: "Город", value: lead.client.city },
    { label: "Эл. почта", value: lead.client.email },
    { label: "Источник", value: lead.source },
    ...lead.customFields.map((field) => ({ label: field.label, value: field.value })),
  ]
  return (
    <div className="space-y-3">
      <dl className="divide-y rounded-lg border">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[minmax(8rem,40%)_1fr] gap-3 px-3 py-2.5 text-sm">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={cn(!row.value && "text-muted-foreground")}>{row.value ?? "Не заполнено"}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Набор полей настраивает компания. Редактирование появится после согласования модели лида с backend.
      </p>
    </div>
  )
}
