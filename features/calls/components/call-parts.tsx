import Link from "next/link"
import { Mic, MicOff, PhoneIncoming, PhoneMissed, PhoneOutgoing, Sparkles, Star } from "lucide-react"

import { leadRoute } from "@/config/routes"
import type { Call } from "@/features/calls/schemas"
import { formatDateTime, formatDuration } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Разговоры короче этого backend не разбирает (правило из инструкций компании) */
export const MIN_ANALYZED_DURATION_SEC = 30

export function CallDirectionIcon({ call, className }: { call: Call; className?: string }) {
  if (call.status === "missed") return <PhoneMissed className={cn("text-destructive", className)} aria-label="Пропущенный" />
  return call.direction === "incoming" ? (
    <PhoneIncoming className={cn("text-muted-foreground", className)} aria-label="Входящий" />
  ) : (
    <PhoneOutgoing className={cn("text-muted-foreground", className)} aria-label="Исходящий" />
  )
}

export function callTitle(call: Call): string {
  if (call.status === "missed") return call.direction === "incoming" ? "Пропущенный входящий" : "Исходящий без ответа"
  return `${call.direction === "incoming" ? "Входящий" : "Исходящий"} · ${formatDuration(call.durationSec)}`
}

export function RatingStars({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Оценка ${score} из 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} className={cn("size-3.5", index < score ? "fill-warning text-warning" : "text-muted-foreground/40")} aria-hidden />
      ))}
    </span>
  )
}

/** Факты звонка — то, что точно известно из телефонии */
export function CallFacts({ call }: { call: Call }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Клиент",
      value: call.lead ? (
        <Link href={leadRoute(call.lead.id)} className="text-primary hover:underline">
          {call.lead.name}
        </Link>
      ) : (
        <span className="text-muted-foreground">Номер не привязан к лиду</span>
      ),
    },
    { label: "Номер", value: <span className="tabular-nums">{call.phone}</span> },
    { label: "Менеджер", value: call.manager.name },
    { label: "Когда", value: formatDateTime(call.at) },
    { label: "Звонок", value: callTitle(call) },
    {
      label: "Запись",
      value: call.hasRecording ? (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Mic className="size-3.5" aria-hidden />
          Есть; прослушивание появится после подключения телефонии
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MicOff className="size-3.5" aria-hidden />
          Нет записи
        </span>
      ),
    },
  ]
  return (
    <dl className="divide-y rounded-lg ring-1 ring-border">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[6.5rem_1fr] gap-3 px-3 py-2 text-meta">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function AnalysisList({ title, items, empty }: { title: string; items: readonly string[]; empty: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {items.length > 0 ? (
        <ul className="space-y-0.5 text-meta">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-muted-foreground" aria-hidden>
                —
              </span>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-meta text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}

/** Анализ ИИ отдельно от фактов: с подписью, временем и честным пустым состоянием */
export function CallAnalysis({ call, isDemoData }: { call: Call; isDemoData: boolean }) {
  const analysis = call.analysis
  const reason =
    call.status === "missed"
      ? "Звонок не состоялся — разбирать нечего."
      : call.durationSec < MIN_ANALYZED_DURATION_SEC
        ? "Разговоры короче 30 секунд не разбираются."
        : "Разбора пока нет: он появится после обработки записи."

  return (
    <section aria-labelledby={`analysis-${call.id}`} className="space-y-3 rounded-lg bg-primary/6 p-3 ring-1 ring-primary/15">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`analysis-${call.id}`} className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <Sparkles className="size-3.5" aria-hidden />
          Разбор ИИ
        </h3>
        {analysis && (
          <span className="text-xs text-muted-foreground">
            {isDemoData ? "пример · демо" : formatDateTime(analysis.generatedAt)}
          </span>
        )}
      </div>
      {analysis ? (
        <>
          <p className="text-sm leading-relaxed">{analysis.summary}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <AnalysisList title="Договорённости" items={analysis.agreements} empty="Не зафиксированы" />
            <AnalysisList title="Возражения" items={analysis.objections} empty="Не прозвучали" />
          </div>
          {analysis.nextAction && (
            <p className="text-meta">
              <span className="text-muted-foreground">Следующий шаг: </span>
              {analysis.nextAction}
            </p>
          )}
        </>
      ) : (
        <p className="text-meta text-muted-foreground">{reason}</p>
      )}
    </section>
  )
}

export function CallTranscript({ call }: { call: Call }) {
  if (!call.transcript) {
    return <p className="text-meta text-muted-foreground">Транскрипции нет.</p>
  }
  return (
    <dl className="space-y-2 text-sm">
      {call.transcript.map((line, index) => (
        <div key={index} className="grid grid-cols-[5.5rem_1fr] gap-2">
          <dt className={cn("text-xs", line.speaker === "manager" ? "text-primary" : "text-muted-foreground")}>
            {line.speaker === "manager" ? "Менеджер" : "Клиент"}
          </dt>
          <dd>{line.text}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Оценка руководителя — только если backend её отдал */
export function CallRating({ call }: { call: Call }) {
  if (!call.rating) return null
  return (
    <section className="space-y-1 rounded-lg ring-1 ring-border p-3" aria-label="Оценка разговора">
      <p className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        Оценка разговора <RatingStars score={call.rating.score} />
      </p>
      {call.rating.comment && <p className="text-meta">{call.rating.comment}</p>}
      <p className="text-xs text-muted-foreground">Видна только руководителям</p>
    </section>
  )
}
