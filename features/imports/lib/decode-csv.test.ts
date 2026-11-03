import { describe, expect, it } from "vitest"

import { decodeCsv, isCsvFile } from "@/features/imports/lib/decode-csv"

const bytes = (values: number[]) => new Uint8Array(values).buffer

describe("чтение CSV из Excel", () => {
  it("UTF-8 с BOM читается без BOM", () => {
    const encoded = new TextEncoder().encode("﻿Имя;Телефон")
    expect(decodeCsv(encoded.buffer as ArrayBuffer)).toBe("Имя;Телефон")
  })

  it("файл в windows-1251 (русский Excel) тоже читается", () => {
    // «Имя» в windows-1251
    expect(decodeCsv(bytes([0xc8, 0xec, 0xff]))).toBe("Имя")
  })

  it("принимаются только CSV и TXT", () => {
    expect(isCsvFile({ name: "clients.CSV", type: "" })).toBe(true)
    expect(isCsvFile({ name: "export", type: "text/csv" })).toBe(true)
    expect(isCsvFile({ name: "clients.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })).toBe(false)
  })
})
