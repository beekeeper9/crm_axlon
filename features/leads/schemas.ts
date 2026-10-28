import { z } from "zod"

/**
 * Минимальная сводка по лиду для заголовка карточки.
 * Полная модель лида (поля, сделки, история) должна быть согласована с backend —
 * состав полей расширяемый и зависит от настроек компании.
 */
export const leadSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  pipelineName: z.string(),
  stageName: z.string(),
  manager: z.object({ id: z.string(), name: z.string() }),
})

export type LeadSummary = z.infer<typeof leadSummarySchema>
