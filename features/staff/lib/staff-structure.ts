import type { StaffMember } from "@/features/staff/schemas"
import type { StaffSession } from "@/features/staff/api/work-sessions"

export type DepartmentGroup = {
  department: { id: string; name: string }
  /** Действующий РОП отдела; null — не назначен */
  head: StaffMember | null
  /** Менеджеры, лидорубы и остальные действующие сотрудники отдела */
  members: StaffMember[]
}

export type StaffStructure = {
  departments: DepartmentGroup[]
  /** Уволенные (отключённые) сотрудники: история работы сохраняется */
  dismissed: StaffMember[]
  /**
   * Действующие сотрудники без отдела. По правилам компании таких быть не должно (отдел
   * обязателен); старые записи не меняются автоматически — директору показывается предупреждение
   */
  unassigned: StaffMember[]
}

/** Руководство компании: в структуре отделов не показывается */
const LEADERSHIP: ReadonlySet<StaffMember["role"]> = new Set(["director", "platform_admin"])

const byName = (a: StaffMember, b: StaffMember) => a.fullName.localeCompare(b.fullName, "ru")

/** Структура «РОП → его менеджеры» по отделам; отделы — по названию; уволенные — отдельно */
export function groupStaff(members: readonly StaffMember[]): StaffStructure {
  const groups = new Map<string, DepartmentGroup>()
  const dismissed: StaffMember[] = []
  const unassigned: StaffMember[] = []
  for (const member of members) {
    if (LEADERSHIP.has(member.role)) continue
    if (member.status === "deactivated") {
      dismissed.push(member)
      continue
    }
    if (!member.department) {
      unassigned.push(member)
      continue
    }
    const group = groups.get(member.department.id) ?? { department: member.department, head: null, members: [] }
    if (member.role === "head_of_sales" && group.head === null) group.head = member
    else group.members.push(member)
    groups.set(member.department.id, group)
  }
  return {
    departments: [...groups.values()]
      .map((group) => ({ ...group, members: group.members.toSorted(byName) }))
      .toSorted((a, b) => a.department.name.localeCompare(b.department.name, "ru")),
    dismissed: dismissed.toSorted(byName),
    unassigned: unassigned.toSorted(byName),
  }
}

export type TodayActivity =
  | { kind: "none" }
  | { kind: "working"; since: string }
  | { kind: "finished"; startedAt: string; endedAt: string; seconds: number | null }
  | { kind: "unconfirmed"; startedAt: string }

/** Активность за сегодня по сменам сотрудника: идёт смена, завершена, конец не отмечен или нет смены */
export function todayActivity(sessions: readonly StaffSession[]): TodayActivity {
  const ordered = sessions.toSorted((a, b) => b.startedAt.localeCompare(a.startedAt))
  const open = ordered.find((session) => session.status === "open")
  if (open) return { kind: "working", since: ordered.at(-1)?.startedAt ?? open.startedAt }
  const latest = ordered[0]
  if (!latest) return { kind: "none" }
  if (latest.status === "unconfirmed" || !latest.endedAt) return { kind: "unconfirmed", startedAt: latest.startedAt }
  const seconds = ordered.reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0)
  return { kind: "finished", startedAt: ordered.at(-1)?.startedAt ?? latest.startedAt, endedAt: latest.endedAt, seconds }
}

/** «7 ч 05 мин» — длительность смены */
export function formatWorkDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60)
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours} ч ${String(minutes % 60).padStart(2, "0")} мин` : `${minutes} мин`
}
