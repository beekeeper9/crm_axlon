import { salesRepository } from "@/features/sales"
import type { ConvertPipeline } from "@/features/prospects/components/convert-dialog"

/**
 * Куда может встать сделка нового клиента: воронки пользователя (backend отдаёт сначала воронки
 * его отдела) и их рабочие этапы. «Встреча перенесена» исключена — ей нужна дата встречи.
 */
export async function loadConvertPipelines(): Promise<ConvertPipeline[]> {
  const config = await salesRepository.getConfig()
  return config.pipelines
    .map((pipeline) => ({
      id: pipeline.id,
      name: pipeline.name,
      stages: pipeline.stages
        .filter((stage) => stage.kind === "open" && stage.systemCode !== "meeting_rescheduled")
        .map(({ id, name }) => ({ id, name })),
    }))
    .filter((pipeline) => pipeline.stages.length > 0)
}
