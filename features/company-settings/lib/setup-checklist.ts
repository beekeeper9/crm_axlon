import type { BackendRole } from "@/lib/permissions/backend-roles"

/** Что нужно, чтобы компания начала работать в CRM: отдел, его РОП, менеджеры и план на месяц */
export type SetupFacts = {
  departments: readonly { id: string }[]
  staff: readonly { role: BackendRole; status: "active" | "invited" | "deactivated"; departmentId: string | null }[]
  hasCompanyPlan: boolean
}

export type SetupStepKey = "department" | "head" | "managers" | "plan"

export type SetupStep = { key: SetupStepKey; title: string; done: boolean }

const HEAD_ROLES: readonly BackendRole[] = ["head_of_sales", "manager"]

/** Шаги в порядке выполнения: каждый следующий опирается на предыдущий */
export function setupSteps({ departments, staff, hasCompanyPlan }: SetupFacts): SetupStep[] {
  const working = staff.filter((member) => member.status !== "deactivated")
  const inDepartment = (roles: readonly BackendRole[]) =>
    working.some((member) => roles.includes(member.role) && member.departmentId !== null)
  return [
    { key: "department", title: "Создать отдел продаж", done: departments.length > 0 },
    { key: "head", title: "Назначить руководителя отдела", done: inDepartment(HEAD_ROLES) },
    { key: "managers", title: "Добавить менеджеров", done: inDepartment(["sales_rep"]) },
    { key: "plan", title: "Задать план компании на месяц", done: hasCompanyPlan },
  ]
}
