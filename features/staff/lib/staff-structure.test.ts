import { describe, expect, it } from "vitest"

import type { StaffSession } from "@/features/staff/api/work-sessions"
import { DEPARTMENT_HAS_HEAD_MESSAGE, staffErrorMessage } from "@/features/staff/lib/staff-messages"
import { formatWorkDuration, groupStaff, todayActivity } from "@/features/staff/lib/staff-structure"
import type { StaffMember } from "@/features/staff/schemas"
import { ApiError } from "@/lib/api/errors"

const member = (id: string, role: StaffMember["role"], department: string | null, extra: Partial<StaffMember> = {}): StaffMember => ({
  id,
  userId: `u-${id}`,
  login: id,
  fullName: id,
  role,
  company: null,
  department: department ? { id: department, name: department === "d1" ? "Отдел продаж" : "Ош" } : null,
  status: "active",
  createdBy: null,
  createdAt: "2026-11-01T10:00:00+06:00",
  ...extra,
})

describe("структура «РОП → менеджеры»", () => {
  it("каждый отдел со своим РОПом, сотрудники без отдела отдельно", () => {
    const structure = groupStaff([
      member("aibek", "manager", "d1"),
      member("rop", "head_of_sales", "d1"),
      member("aziz", "manager", "d2"),
      member("director", "director", null),
      member("former", "manager", "d1", { status: "deactivated" }),
      member("nurlan", "manager", "d1"),
    ])
    expect(structure.departments.map((group) => [group.department.name, group.head?.id ?? null])).toEqual([
      ["Отдел продаж", "rop"],
      ["Ош", null],
    ])
    // Отключённые — в конце отдела
    expect(structure.departments[0].members.map((m) => m.id)).toEqual(["aibek", "nurlan", "former"])
    expect(structure.withoutDepartment.map((m) => m.id)).toEqual(["director"])
  })
})

const session = (startedAt: string, status: StaffSession["status"], endedAt: string | null = null, durationSeconds: number | null = null): StaffSession => ({
  id: startedAt,
  userId: "u-1",
  status,
  startedAt,
  endedAt,
  durationSeconds,
})

describe("работа сегодня", () => {
  it("идёт смена — с первого входа за день", () => {
    const activity = todayActivity([session("2026-11-03T09:00:00+06:00", "closed", "2026-11-03T12:00:00+06:00", 10800), session("2026-11-03T13:00:00+06:00", "open")])
    expect(activity).toEqual({ kind: "working", since: "2026-11-03T09:00:00+06:00" })
  })

  it("смены закончены — начало первой, конец последней и сумма длительностей", () => {
    const activity = todayActivity([
      session("2026-11-03T09:00:00+06:00", "closed", "2026-11-03T12:00:00+06:00", 10800),
      session("2026-11-03T13:00:00+06:00", "closed", "2026-11-03T18:00:00+06:00", 18000),
    ])
    expect(activity).toEqual({ kind: "finished", startedAt: "2026-11-03T09:00:00+06:00", endedAt: "2026-11-03T18:00:00+06:00", seconds: 28800 })
    expect(formatWorkDuration(28800)).toBe("8 ч 00 мин")
  })

  it("окно закрыли без выхода — конец не отмечен; смен нет — не работал", () => {
    expect(todayActivity([session("2026-11-03T09:00:00+06:00", "unconfirmed")]).kind).toBe("unconfirmed")
    expect(todayActivity([]).kind).toBe("none")
  })
})

describe("ошибки найма", () => {
  it("второй РОП в отдел — сообщение по коду, по-русски", () => {
    const error = new ApiError("conflict", "This department already has an active head of sales.", { code: "department_has_head" })
    expect(staffErrorMessage(error)).toBe(DEPARTMENT_HAS_HEAD_MESSAGE)
  })
})
