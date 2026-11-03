import { describe, expect, it } from "vitest"

import { leadsToCsv } from "@/features/staff/api/staff-profile"
import { DEPARTMENT_REQUIRED_MESSAGE, HAS_HISTORY_MESSAGE, NO_DEPARTMENT_MESSAGE, staffErrorMessage } from "@/features/staff/lib/staff-messages"
import { ApiError } from "@/lib/api/errors"

describe("база лидов в CSV", () => {
  it("заголовок по-русски, BOM для Excel, кавычки и запятые экранируются", () => {
    const csv = leadsToCsv([
      { id: "l1", name: 'ОсОО "Альфа", филиал', phone: "+996555000001", email: null, source: "website", status: "new", createdAt: "2026-11-01T10:00:00+06:00" },
    ])
    expect(csv.startsWith("﻿Имя,Телефон,E-mail,Источник,Статус,Создан\r\n")).toBe(true)
    expect(csv).toContain('"ОсОО ""Альфа"", филиал",+996555000001,,website,new,2026-11-01')
  })
})

describe("сообщения правил сотрудников по коду backend", () => {
  it.each([
    ["department_required", DEPARTMENT_REQUIRED_MESSAGE],
    ["no_department", NO_DEPARTMENT_MESSAGE],
    ["has_history", HAS_HISTORY_MESSAGE],
  ])("%s", (code, message) => {
    expect(staffErrorMessage(new ApiError("validation", "English text", { code }))).toBe(message)
  })

  it("текст для РОПа без отдела — как в требованиях", () => {
    expect(NO_DEPARTMENT_MESSAGE).toBe("Сначала создайте отдел продаж. После этого вы сможете назначить руководителя отдела")
    expect(DEPARTMENT_REQUIRED_MESSAGE).toBe("Выберите отдел, к которому будет прикреплён сотрудник")
  })
})
