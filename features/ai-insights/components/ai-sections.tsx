import { ApiErrorState } from "@/components/shared/api-error-state"
import { fetchAiAvailable, fetchCallSummary, fetchDealBrief } from "@/features/ai-insights/api/ai-insights"
import { CallAiSummary } from "@/features/ai-insights/components/call-ai-summary"
import { DealAiBrief } from "@/features/ai-insights/components/deal-ai-brief"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"

/** Блок ИИ в карточке звонка; когда ИИ не подключён, тарифом не разрешён или нет права — его нет */
export async function CallAiSection({ callId }: { callId: string }) {
  if (!(await fetchAiAvailable())) return null
  const latest = await tryLoad(async () => fetchCallSummary(await getRenderAuth(), callId))
  if (!latest.ok) return <ApiErrorState error={latest.error} bare />
  return <CallAiSummary callId={callId} initial={latest.data} />
}

/** Блок «Что по сделке?»; условия те же */
export async function DealAiSection({ dealId }: { dealId: string }) {
  if (!(await fetchAiAvailable())) return null
  const latest = await tryLoad(async () => fetchDealBrief(await getRenderAuth(), dealId))
  if (!latest.ok) return <ApiErrorState error={latest.error} bare />
  return <DealAiBrief dealId={dealId} initial={latest.data} />
}
