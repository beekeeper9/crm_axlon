import {
  ArrowRight,
  CircleDollarSign,
  ListChecks,
  MessageSquare,
  NotebookPen,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Sparkles,
  Star,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { Card } from "@/components/ui/card"
import { leadsRepository } from "@/features/leads/api/leads-repository"
import type { ActivityKind, LeadDetail } from "@/features/leads/schemas"
import { formatDateTime, formatDayMonth, formatDecimalMoney, formatDuration } from "@/lib/format"

/** Контекст ИИ «Что по сделке?» — первое, что видит менеджер, открыв карточку */
export function LeadAiContext({ lead, isDemoData }: { lead: LeadDetail; isDemoData: boolean }) {
  const ai = lead.aiContext
  return (
    <Card className="gap-3 border-primary/20 bg-primary/5 px-4 py-4 ring-primary/15">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Что по сделке?
        </h2>
        {ai && (
          <span className="text-xs text-muted-foreground">
            {isDemoData ? "пример текста · демо" : `обновлено ${formatDateTime(ai.generatedAt)}`}
          </span>
        )}
      </div>
      {ai ? (
        <>
          <p className="text-sm leading-relaxed">{ai.summary}</p>
          {ai.nextSteps.length > 0 && (
            <ul className="space-y-1">
              {ai.nextSteps.map((step) => (
                <li key={step} className="flex items-start gap-2 text-sm text-foreground/90">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  {step}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Сводка появится, когда по лиду накопятся звонки, переписка или встречи и будет подключён ИИ-сервис.
        </p>
      )}
    </Card>
  )
}

/** Следующий шаг по сделке: главный ориентир «что сделать дальше» */
export function LeadNextStep({ lead }: { lead: LeadDetail }) {
  const next = lead.nextAction
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3",
        !next ? "border-warning/30 bg-warning/6" : next.isOverdue ? "border-destructive/30 bg-destructive/6" : "bg-card"
      )}
    >
      <ArrowRight className={cn("mt-0.5 size-4 shrink-0", next?.isOverdue ? "text-destructive" : next ? "text-primary" : "text-warning")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Следующий шаг</p>
        {next ? (
          <p className="text-sm font-medium">
            {next.title}
            {next.dueAt && <span className={cn("font-normal", next.isOverdue ? "text-destructive" : "text-muted-foreground")}> · {formatDateTime(next.dueAt)}</span>}
            {next.isOverdue && <span className="font-normal text-destructive"> · просрочен</span>}
          </p>
        ) : (
          <p className="text-sm font-medium text-warning">Не назначен — поставьте задачу или встречу, чтобы лид не потерялся</p>
        )}
      </div>
    </div>
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

function RatingStars({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Оценка ${score} из 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} className={cn("size-3.5", index < score ? "fill-warning text-warning" : "text-muted-foreground/40")} aria-hidden />
      ))}
    </span>
  )
}

export async function LeadCalls({ leadId, isDemoData }: { leadId: string; isDemoData: boolean }) {
  const calls = await leadsRepository.getCalls(leadId)
  if (calls.length === 0) {
    return <EmptyState icon={Phone} title="Звонков пока нет" description="Звонки появятся после подключения телефонии; разговоры от 30 секунд разбираются автоматически." />
  }
  return (
    <ul className="space-y-3">
      {calls.map((call) => {
        const DirectionIcon = call.direction === "incoming" ? PhoneIncoming : PhoneOutgoing
        return (
          <li key={call.id}>
            <Card className="gap-3 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <DirectionIcon className="size-4 text-muted-foreground" aria-hidden />
                  {call.direction === "incoming" ? "Входящий" : "Исходящий"} · {formatDuration(call.durationSec)}
                  <span className="font-normal text-muted-foreground">· {formatDateTime(call.at)} · {call.manager.name}</span>
                </p>
                {/* rating приходит только руководителю — у менеджера блока просто нет */}
                {call.rating && (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    Оценка разговора <RatingStars score={call.rating.score} />
                  </span>
                )}
              </div>
              {call.summary && (
                <p className="text-sm">
                  <span className="font-medium text-primary">Итог{isDemoData && " · демо"}:</span> {call.summary}
                </p>
              )}
              {call.rating?.comment && <p className="text-sm text-muted-foreground">Комментарий руководителя: {call.rating.comment}</p>}
              {call.transcript && (
                <details className="group/transcript rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground select-none hover:text-foreground">
                    Транскрипция
                  </summary>
                  <dl className="mt-2 space-y-1.5">
                    {call.transcript.map((line, index) => (
                      <div key={index} className="grid grid-cols-[5.5rem_1fr] gap-2">
                        <dt className="text-xs text-muted-foreground">{line.speaker === "manager" ? "Менеджер" : "Клиент"}</dt>
                        <dd>{line.text}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </Card>
          </li>
        )
      })}
    </ul>
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
