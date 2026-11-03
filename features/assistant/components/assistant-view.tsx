import { PageHeader } from "@/components/shared/page-header"
import { DemoNotice } from "@/components/shared/demo-notice"
import { isMockDataSource } from "@/config/env"
import { getAssistantRunAction } from "@/features/assistant/actions"
import { AssistantChat } from "@/features/assistant/components/assistant-chat"
import { getParam, type SearchParamsRecord } from "@/lib/search-params"

/** «ИИ-помощник»: вопрос на естественном языке и действия, которые выполняются только по подтверждению */
export async function AssistantView({ params }: { params: SearchParamsRecord }) {
  const runId = getParam(params, "run")
  const loaded = runId && !isMockDataSource ? await getAssistantRunAction(runId) : null

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title="ИИ-помощник"
        description="Опишите задачу своими словами — помощник предложит действия в CRM. Числа и отчёты считает система, а не ИИ."
      />
      {isMockDataSource && <DemoNotice>Демо-режим: ИИ-помощник работает только с подключённым сервером.</DemoNotice>}
      <AssistantChat
        key={runId ?? "new"}
        initialRun={loaded?.ok ? loaded.data : null}
        initialError={loaded && !loaded.ok ? loaded.message : null}
      />
    </div>
  )
}
