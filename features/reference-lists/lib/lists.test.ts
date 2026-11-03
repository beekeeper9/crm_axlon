import { describe, expect, it } from "vitest"

import { moveItem, REFERENCE_LIST_META, REFERENCE_LISTS } from "@/features/reference-lists/lib/lists"

describe("moveItem", () => {
  it("swaps an item with its neighbour", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"])
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"])
  })

  it("returns null at the edges", () => {
    expect(moveItem(["a", "b"], 0, -1)).toBeNull()
    expect(moveItem(["a", "b"], 1, 1)).toBeNull()
  })
})

describe("reference lists", () => {
  it("lead sources are a fixed set: no adding or reordering", () => {
    expect(REFERENCE_LIST_META.lead_source).toMatchObject({ canAdd: false, canReorder: false })
    expect(REFERENCE_LISTS).toContain("loss_reason")
  })
})
