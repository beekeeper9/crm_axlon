import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const apiRequest = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}) }))

const { commitImportAction, previewImportAction } = await import("@/features/imports/actions")
const { importPreviewSchema } = await import("@/features/imports/schemas")
const { importTemplateCsv } = await import("@/features/imports/lib/import-templates")

const request = { entity: "leads", filename: "leads.csv", content: "Имя;Телефон\nАйбек;+996555123456\n", ownerUserId: null }

describe("загрузка из файла", () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it("ответственный уходит только если выбран другой сотрудник", async () => {
    apiRequest.mockResolvedValue({})
    await previewImportAction(request)
    expect(apiRequest.mock.calls[0]?.[1].body).toEqual({ entity: "leads", filename: "leads.csv", content: request.content })
    await commitImportAction({ ...request, ownerUserId: "u-7" })
    expect(apiRequest.mock.calls[1]?.[0]).toBe("/api/v1/imports/")
    expect(apiRequest.mock.calls[1]?.[1].body).toMatchObject({ ownerUserId: "u-7" })
  })

  it("ошибку разбора файла backend пишет по-русски — показываем её", async () => {
    apiRequest.mockRejectedValue(new ApiError("validation", "Нет колонки с именем", { status: 400 }))
    expect(await previewImportAction(request)).toEqual({ ok: false, message: "Нет колонки с именем" })
  })

  it("пустой файл не отправляется", async () => {
    expect(await previewImportAction({ ...request, content: "" })).toEqual({ ok: false, message: "Файл пустой" })
    expect(apiRequest).not.toHaveBeenCalled()
  })
})

describe("загрузка сделок", () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it("сделки уходят на тот же endpoint; ответственный передаётся и в проверку", async () => {
    apiRequest.mockResolvedValue({})
    const deals = { entity: "deals", filename: "deals.csv", content: "Сделка;Этап\nПоставка;Продажа\n", ownerUserId: "u-7" }
    await previewImportAction(deals)
    expect(apiRequest.mock.calls[0]?.[0]).toBe("/api/v1/imports/preview/")
    expect(apiRequest.mock.calls[0]?.[1].body).toEqual({ entity: "deals", filename: "deals.csv", content: deals.content, ownerUserId: "u-7" })
  })

  it("строки сделок разбираются со сведениями о создаваемой сделке, ошибки строк сохраняются", () => {
    const preview = importPreviewSchema.parse({
      entity: "deals",
      total: 2,
      new: 1,
      duplicates: 0,
      invalid: 1,
      rows: [
        {
          line: 2,
          name: "Поставка",
          phone: "+996555123456",
          email: null,
          source: null,
          status: "new",
          reason: null,
          duplicateOf: null,
          duplicateLine: null,
          deal: {
            title: "Поставка",
            amount: "1000.00",
            currency: "KGS",
            pipelineId: "p-1",
            pipelineName: "Продажи",
            stageId: "s-1",
            stageName: "Новый",
            ownerUserId: "u-1",
            customerId: null,
            customerName: "ОсОО Альфа",
            customerAction: "create",
            hasNextStep: false,
          },
        },
        { line: 3, name: "Продано", phone: null, email: null, source: null, status: "invalid", reason: "Этап «Продажа» означает продажу", duplicateOf: null, duplicateLine: null, deal: null },
      ],
    })
    expect(preview.rows[0]?.deal?.customerAction).toBe("create")
    expect(preview.rows[1]?.reason).toContain("Продажа")
  })

  it("строки лидов без поля deal тоже принимаются", () => {
    const row = { line: 2, name: "Айгуль", phone: null, email: "a@b.kg", source: null, status: "new", reason: null, duplicateOf: null, duplicateLine: null }
    expect(importPreviewSchema.parse({ entity: "leads", total: 1, new: 1, duplicates: 0, invalid: 0, rows: [row] }).rows[0]?.deal).toBeNull()
  })

  it("шаблон сделок: заголовки, которые узнаёт backend, и пример строки той же ширины", () => {
    const [header, example] = importTemplateCsv("deals").replace("﻿", "").split("\r\n")
    const columns = header?.split(";") ?? []
    expect(columns.slice(0, 6)).toEqual(["Сделка", "Сумма", "Валюта", "Воронка", "Этап", "Ответственный"])
    expect(columns).toContain("Причина проигрыша")
    expect(example?.split(";")).toHaveLength(columns.length)
  })
})
