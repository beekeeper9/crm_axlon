"use client"

import { ArrowRight } from "lucide-react"

import { getDealBriefAction, requestDealBriefAction } from "@/features/ai-insights/actions"
import type { DealBrief } from "@/features/ai-insights/api/ai-insights"
import { AI_DISCLAIMER, AiHeading, AiNotes, AiRunButton } from "@/features/ai-insights/components/ai-parts"
import { useAiJob } from "@/features/ai-insights/components/use-ai-job"

/** «Что по сделке?»: личный бриф к разговору; ничего в сделке сам не меняет */
export function DealAiBrief({ dealId, initial }: { dealId: string; initial: DealBrief | null }) {
  const { job, failure, isWaitingTooLong, isBusy, start } = useAiJob(
    initial,
    () => requestDealBriefAction(dealId),
    () => getDealBriefAction(dealId)
  )
  const result = job?.status === "succeeded" ? job.result : null
  const steps = result ? [...(result.nextStep ? [result.nextStep.text] : []), ...result.questions.map((point) => point.text)] : []
  return (
    <div className="space-y-2 border-t px-4 py-3">
      <AiHeading title="Что по сделке?" at={job?.finishedAt ?? null} isMock={job?.isMock ?? false} />
      {result?.insufficientData && <p className="text-meta text-muted-foreground">Мало истории для брифа: добавьте заметки, звонки или встречи.</p>}
      {result && !result.insufficientData && (
        <>
          <p className="text-sm leading-relaxed text-foreground/90">{result.situation.map((point) => point.text).join(" ")}</p>
          {steps.length > 0 && (
            <ul className="space-y-1">
              {steps.map((step) => (
                <li key={step} className="flex items-start gap-2 text-meta text-muted-foreground">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary/80" aria-hidden />
                  {step}
                </li>
              ))}
            </ul>
          )}
          {result.risks.length > 0 && <p className="text-meta text-warning">Риски: {result.risks.map((point) => point.text).join(" ")}</p>}
          <p className="text-xs text-muted-foreground">{AI_DISCLAIMER}</p>
        </>
      )}
      <AiNotes failure={failure} failed={job?.status === "failed"} isWaitingTooLong={isWaitingTooLong} />
      <AiRunButton label={job ? "Обновить бриф" : "Подготовить бриф"} isBusy={isBusy} onClick={start} />
    </div>
  )
}
