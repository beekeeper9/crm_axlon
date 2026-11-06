"use client"

import { getCallSummaryAction, requestCallSummaryAction } from "@/features/ai-insights/actions"
import type { CallSummary } from "@/features/ai-insights/api/ai-insights"
import { AI_DISCLAIMER, AiHeading, AiNotes, AiRunButton } from "@/features/ai-insights/components/ai-parts"
import { useAiJob } from "@/features/ai-insights/components/use-ai-job"

/**
 * «Разбор ИИ» звонка по заметке к нему. Проверенные цитатами пункты идут первыми: свободный
 * текст `summary` backend не проверяет. Возражений и цели звонка в контракте модели нет.
 */
export function CallAiSummary({ callId, initial }: { callId: string; initial: CallSummary | null }) {
  const { job, failure, isWaitingTooLong, isBusy, start } = useAiJob(
    initial,
    () => requestCallSummaryAction(callId),
    () => getCallSummaryAction(callId)
  )
  const result = job?.status === "succeeded" ? job.result : null
  return (
    <section aria-label="Разбор ИИ" className="space-y-3 rounded-lg bg-primary/6 p-3 ring-1 ring-primary/15">
      <AiHeading title="Разбор ИИ" at={job?.finishedAt ?? null} isMock={job?.isMock ?? false} />
      {result?.insufficientData && <p className="text-meta text-muted-foreground">Мало информации для разбора: добавьте к звонку подробную заметку.</p>}
      {result && !result.insufficientData && (
        <>
          {result.keyPoints.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {result.keyPoints.map((point) => (
                <li key={point.evidenceQuote}>
                  {point.text}
                  <span className="block text-xs text-muted-foreground italic">«{point.evidenceQuote}»</span>
                </li>
              ))}
            </ul>
          )}
          {result.nextStep && (
            <p className="text-meta">
              <span className="text-muted-foreground">Следующий шаг: </span>
              {result.nextStep.text}
            </p>
          )}
          <p className="text-sm leading-relaxed text-foreground/90">{result.summary}</p>
          <p className="text-xs text-muted-foreground">{AI_DISCLAIMER}</p>
        </>
      )}
      <AiNotes failure={failure} failed={job?.status === "failed"} isWaitingTooLong={isWaitingTooLong} />
      {!result && <AiRunButton label={job ? "Разобрать снова" : "Разобрать звонок"} isBusy={isBusy} onClick={start} />}
    </section>
  )
}
