import type { FunnelStage } from "@/features/dashboard/schemas"

/**
 * Узкое место воронки — этап с самой низкой конверсией в следующий.
 * Простое правило для MVP; позже РОП сможет задавать целевые конверсии по этапам.
 */
export function findBottleneckStageId(stages: readonly FunnelStage[]): string | null {
  let bottleneck: FunnelStage | null = null
  for (const stage of stages) {
    if (stage.conversionToNext === null) continue
    if (bottleneck === null || stage.conversionToNext < (bottleneck.conversionToNext ?? 1)) {
      bottleneck = stage
    }
  }
  return bottleneck?.id ?? null
}
