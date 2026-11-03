import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const apiRequest = vi.fn()
const fetchStaff = vi.fn()
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/features/departments/api/department-analytics", () => ({ fetchStaff: (...args: unknown[]) => fetchStaff(...args) }))

const { exportCustomers, exportLeads, toCsv } = await import("@/features/imports/api/list-export")

const auth = {} as never
const lead = (name: string) => ({ name, phone: "+996555000111", email: null, source: "website", status: "new", ownerUserId: "u-1", createdAt: "2026-11-02T10:00:00+06:00" })

describe("выгрузка списков в CSV", () => {
  beforeEach(() => {
    apiRequest.mockReset()
    fetchStaff.mockReset()
  })

  it("ячейки с «;», кавычками и переносами экранируются; файл с BOM", () => {
    const csv = toCsv(["Имя", "Комментарий"], [["ООО «Альфа»; филиал", 'сказал "да"\nпотом']])
    expect(csv.startsWith("﻿Имя;Комментарий\r\n")).toBe(true)
    expect(csv).toContain('"ООО «Альфа»; филиал";"сказал ""да""\nпотом"')
  })

  it("лиды: фильтры списка уходят на backend, страницы собираются до конца, подписи по-русски", async () => {
    fetchStaff.mockResolvedValue([{ userId: "u-1", name: "Айбек" }])
    apiRequest
      .mockResolvedValueOnce({ count: 201, results: Array.from({ length: 200 }, (_, i) => lead(`Лид ${i}`)) })
      .mockResolvedValueOnce({ count: 201, results: [lead("Последний")] })
    const file = await exportLeads(auth, new URLSearchParams("q=ан&status=new&owner=u-1&page=3"))
    expect(apiRequest).toHaveBeenCalledTimes(2)
    expect(apiRequest.mock.calls[0]?.[1].query).toEqual({ search: "ан", status: "new", source: undefined, ownerId: "u-1", limit: "200", offset: "0" })
    expect(apiRequest.mock.calls[1]?.[1].query.offset).toBe("200")
    expect(file).toMatchObject({ total: 201, exported: 201 })
    expect(file.csv).toContain("Последний;+996555000111;;Сайт;Новый;Айбек;2026-11-02")
  })

  it("клиенты: менеджеру список сотрудников закрыт — выгрузка идёт без имён ответственных", async () => {
    fetchStaff.mockRejectedValue(new ApiError("forbidden", "denied", { status: 403 }))
    apiRequest.mockResolvedValueOnce({
      count: 1,
      results: [{ name: "Клиент", phone: null, email: "a@b.kg", ownerUserId: "u-2", archivedAt: null, createdAt: "2026-11-01T09:00:00+06:00" }],
    })
    const file = await exportCustomers(auth, new URLSearchParams("status=active"))
    expect(apiRequest.mock.calls[0]?.[1].query.archived).toBe("false")
    expect(file.csv).toContain("Клиент;;a@b.kg;;нет;2026-11-01")
  })
})
