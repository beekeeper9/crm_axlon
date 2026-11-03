import { describe, expect, it } from "vitest"

import type { FunnelStage } from "@/features/sales/funnel/funnel-api"
import { FUNNEL_TEMPLATE, isLastOfKind, movedOrder, moveTargets, suggestStageMap } from "@/features/sales/funnel/funnel-rules"

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

  it("«Продажа» остаётся последней: её не двигают, и выключенные этапы встают перед ней", () => {
    const withSystem: FunnelStage[] = [
      stage("a", 0),
      { ...stage("moved", 1), systemCode: "meeting_rescheduled", isActive: false },
      stage("lost", 2, "lost"),
      { ...stage("sale", 3, "won"), systemCode: "sale" },
    ]
    expect(movedOrder(withSystem, "lost", -1)).toEqual(["lost", "a", "moved", "sale"])
    expect(movedOrder(withSystem, "lost", 1)).toBeNull()
    expect(movedOrder(withSystem, "sale", -1)).toBeNull()
  })

  it("сделки удаляемого этапа переносятся только на рабочий этап того же вида", () => {
    expect(moveTargets(stages, "b").map((item) => item.id)).toEqual(["a", "c"])
    expect(isLastOfKind(stages, "won")).toBe(true)
    expect(isLastOfKind(stages, "a")).toBe(false)
  })
})

describe("suggestStageMap", () => {
  const target = [
    { id: "t1", name: "Новый лид", position: 0, kind: "open" as const, isActive: true },
    { id: "t2", name: "Тёплый", position: 1, kind: "open" as const, isActive: true },
    { id: "tw", name: "Успех", position: 2, kind: "won" as const, isActive: true },
  ]

  it("тот же этап по названию, иначе по позиции; только рабочие этапы; пустые пропускаются", () => {
    const map = suggestStageMap(
      [
        { stageId: "s1", name: "тёплый", openDeals: 2 },
        { stageId: "s2", name: "Переговоры", openDeals: 1 },
        { stageId: "s3", name: "Счёт", openDeals: 4 },
        { stageId: "s4", name: "Пусто", openDeals: 0 },
      ],
      target
    )
    expect(map).toEqual({ s1: "t2", s2: "t2", s3: "t2" })
  })

  it("без рабочих этапов в воронке отдела — нечего предлагать", () => {
    expect(suggestStageMap([{ stageId: "s1", name: "A", openDeals: 1 }], [target[2]])).toEqual({})
  })
})
