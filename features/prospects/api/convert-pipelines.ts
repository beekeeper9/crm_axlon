import { listProducts } from "@/features/products"
import type { ConvertOptions } from "@/features/prospects/components/convert-dialog"
import { salesRepository } from "@/features/sales"
import { getRenderAuth } from "@/lib/auth/token-store"

/**
 * Куда может встать сделка нового клиента: воронки пользователя (backend отдаёт сначала воронки
 * его отдела) и их рабочие этапы. «Встреча перенесена» исключена — ей нужна дата встречи.
 * И что она продаёт: активные продукты компании.
 */
export async function loadConvertOptions(): Promise<ConvertOptions> {
  const [config, products] = await Promise.all([salesRepository.getConfig(), getRenderAuth().then((auth) => listProducts(auth, true))])
  const pipelines = config.pipelines
    .map((pipeline) => ({
      id: pipeline.id,
      name: pipeline.name,
      stages: pipeline.stages
        .filter((stage) => stage.kind === "open" && stage.systemCode !== "meeting_rescheduled")
        .map(({ id, name }) => ({ id, name })),
    }))
    .filter((pipeline) => pipeline.stages.length > 0)
  return { pipelines, products: products.map(({ id, name }) => ({ id, name })) }
}
