import { describe, expect, it } from "vitest"

import type { FunnelStage } from "@/features/sales/funnel/funnel-api"
import { FUNNEL_TEMPLATE, isLastOfKind, movedOrder, moveTargets } from "@/features/sales/funnel/funnel-rules"

const stage = (id: string, position: number, kind: FunnelStage["kind"] = "open", isActive = true): FunnelStage => ({
  id,
  name: id,
  position,
  kind,
  isActive,
})

const stages = [stage("a", 0), stage("b", 1), stage("old", 2, "open", false), stage("c", 3), stage("won", 4, "won"), stage("lost", 5, "lost")]

describe("настройка воронки", () => {
  it("шаблон: рабочие этапы, один успех и один отказ", () => {
    expect(FUNNEL_TEMPLATE.filter((item) => item.kind === "won")).toHaveLength(1)
    expect(FUNNEL_TEMPLATE.filter((item) => item.kind === "lost")).toHaveLength(1)
  })

  it("сдвиг этапа сохраняет архивные этапы в полном списке", () => {
    expect(movedOrder(stages, "c", -1)).toEqual(["a", "c", "b", "won", "lost", "old"])
    expect(movedOrder(stages, "a", -1)).toBeNull()
  })

  it("сделки удаляемого этапа переносятся только на рабочий этап того же вида", () => {
    expect(moveTargets(stages, "b").map((item) => item.id)).toEqual(["a", "c"])
    expect(isLastOfKind(stages, "won")).toBe(true)
    expect(isLastOfKind(stages, "a")).toBe(false)
  })
})
