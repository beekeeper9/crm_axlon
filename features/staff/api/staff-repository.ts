import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import {
  approvedRequestSchema,
  createdAccountSchema,
  createOptionsSchema,
  staffMemberSchema,
  staffRequestSchema,
  type ApprovedRequest,
  type CreatedAccount,
  type CreateOptions,
  type CreateStaffInput,
  type StaffMember,
  type StaffRequest,
} from "@/features/staff/schemas"
import { loadMemberNames } from "@/features/team"
import { apiRequest } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { paginatedSchema } from "@/lib/api/pagination"
import { getActionAuth, getRenderAuth } from "@/lib/auth/token-store"
import { backendRoleFromUi, backendRoleSchema, uiRoleFromBackend } from "@/lib/permissions/backend-roles"
import { CREATABLE_ROLE } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"
import { demoAccount, demoAccounts, demoCompany, demoCreateAccount, demoDepartment, demoDepartmentsOf, demoVisibleAccounts, type DemoAccount } from "@/mocks/demo-accounts"
import { simulateLatency } from "@/mocks/latency"

/** Создатель и область видимости — из сессии (backend — из токена), а не из параметров запроса */
export type StaffRepository = {
  listStaff(): Promise<StaffMember[]>
  getCreateOptions(): Promise<CreateOptions>
  createAccount(input: CreateStaffInput): Promise<CreatedAccount>
  /** Заявки на найм и увольнение: директору — компании, РОПу — его отдела */
  listRequests(): Promise<StaffRequest[]>
  /** РОП просит директора нанять сотрудника в свой отдел */
  requestHire(input: CreateStaffInput): Promise<StaffRequest>
  /** Директор одобряет: найм создаёт аккаунт, пароль — один раз в ответе */
  approveRequest(requestId: string): Promise<ApprovedRequest>
  rejectRequest(requestId: string, note: string): Promise<StaffRequest>
  cancelRequest(requestId: string): Promise<StaffRequest>
  createDepartment(name: string): Promise<{ id: string; name: string }>
  /** Отключить аккаунт: вход блокируется, открытые задачи и сделки переходят к тому, кто отключил */
  deactivate(membershipId: string): Promise<void>
  /** Новый временный пароль (показывается один раз; старый и открытые сессии перестают работать) */
  resetPassword(membershipId: string): Promise<string>
}

/** Заявок и новых отделов в демо-режиме нет: они существуют только на сервере */
function demoOnlyServer(): never {
  throw new ApiError("contract_pending", "В демо-режиме заявки и отделы не сохраняются")
}

function toMember(account: DemoAccount): StaffMember {
  const company = demoCompany(account.companyId)
  const department = demoDepartment(account.departmentId)
  const creator = account.createdById ? demoAccount(account.createdById) : null
  return {
    id: account.id,
    userId: account.id,
    login: account.login,
    fullName: account.fullName,
    role: account.role,
    company: company && { id: company.id, name: company.name },
    department: department && { id: department.id, name: department.name },
    status: account.status,
    createdBy: creator && { id: creator.id, name: creator.fullName },
    createdAt: account.createdAt,
  }
}

const mockStaffRepository: StaffRepository = {
  async listStaff() {
    await simulateLatency(300)
    const user = await getCurrentUser()
    return staffMemberSchema.array().parse(
      demoVisibleAccounts(user.id).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toMember)
    )
  },

  async getCreateOptions() {
    await simulateLatency(150)
    const user = await getCurrentUser()
    const account = demoAccounts().find((item) => item.id === user.id)
    const department = demoDepartment(account?.departmentId ?? null)
    const role = CREATABLE_ROLE[user.role] ?? null
    return createOptionsSchema.parse({
      creatableRole: role,
      roles: role ? [role] : [],
      mode: "direct",
      departments: user.role === "director" && account?.companyId ? demoDepartmentsOf(account.companyId).map(({ id, name }) => ({ id, name })) : [],
      fixedDepartment: user.role === "head_of_sales" && department ? { id: department.id, name: department.name } : null,
      loginIsOptional: true,
    })
  },

  async createAccount(input) {
    await simulateLatency(500)
    const user = await getCurrentUser()
    const result = demoCreateAccount(user.id, input)
    if (!result.ok) {
      throw new ApiError(result.status === 403 ? "forbidden" : "validation", result.message, {
        status: result.status,
        code: result.status === 403 ? "permission_denied" : "validation_error",
        fieldErrors: result.field ? { [result.field]: [result.message] } : undefined,
      })
    }
    return createdAccountSchema.parse({ member: toMember(result.account), temporaryPassword: result.temporaryPassword })
  },

  async listRequests() {
    return []
  },
  requestHire: demoOnlyServer,
  approveRequest: demoOnlyServer,
  rejectRequest: demoOnlyServer,
  cancelRequest: demoOnlyServer,
  createDepartment: demoOnlyServer,
  deactivate: demoOnlyServer,
  resetPassword: demoOnlyServer,
}

const backendDepartmentSchema = z.object({ id: z.string(), name: z.string(), isActive: z.boolean() })

/** `GET /api/v1/staff/`: сотрудники в области пользователя (директор — компания, РОП — отдел) */
const backendStaffSchema = z.object({
  id: z.string(),
  userId: z.string(),
  login: z.string(),
  fullName: z.string(),
  role: backendRoleSchema,
  department: backendDepartmentSchema.nullable(),
  status: z.enum(["active", "invited", "deactivated"]),
  createdBy: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
})

const backendCreateOptionsSchema = z.object({
  creatableRoles: z.array(backendRoleSchema),
  departments: z.array(backendDepartmentSchema),
  fixedDepartmentId: z.string().nullable(),
  mode: z.enum(["direct", "request"]),
  /** РОП может создавать менеджеров своего отдела напрямую (backend с 02.11.2026) */
  canCreateDirectly: z.boolean().optional(),
})

const backendRequestSchema = z.object({
  id: z.string(),
  kind: z.enum(["hire", "dismiss"]),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]),
  department: backendDepartmentSchema,
  requestedBy: z.object({ id: z.string(), name: z.string() }),
  createdAt: z.iso.datetime({ offset: true }),
  candidate: z.object({ fullName: z.string(), login: z.string().nullable(), role: backendRoleSchema }).nullable(),
  target: z.object({ membershipId: z.string(), name: z.string().nullable() }).nullable(),
  reason: z.string(),
  decidedBy: z.string().nullable(),
  decidedAt: z.iso.datetime({ offset: true }).nullable(),
  decisionNote: z.string(),
  resultMembershipId: z.string().nullable(),
})

function toRequest(request: z.infer<typeof backendRequestSchema>): StaffRequest {
  return staffRequestSchema.parse({
    ...request,
    department: { id: request.department.id, name: request.department.name },
    candidate: request.candidate && { ...request.candidate, role: uiRoleFromBackend(request.candidate.role) },
    target: request.target && { id: request.target.membershipId, name: request.target.name ?? "—" },
  })
}

function ref(department: z.infer<typeof backendDepartmentSchema> | null) {
  return department && { id: department.id, name: department.name }
}

const httpStaffRepository: StaffRepository = {
  async listStaff() {
    const auth = await getRenderAuth()
    const [staff, names, user] = await Promise.all([
      apiRequest("/api/v1/staff/", { auth, schema: paginatedSchema(backendStaffSchema) }),
      loadMemberNames(),
      getCurrentUser(),
    ])
    return staff.results.map((member) => ({
      id: member.id,
      userId: member.userId,
      login: member.login,
      fullName: member.fullName || member.login,
      role: uiRoleFromBackend(member.role),
      company: { id: auth.tenant ?? "", name: user.companyName },
      department: ref(member.department),
      status: member.status,
      createdBy: member.createdBy ? { id: member.createdBy, name: names.get(member.createdBy) ?? "—" } : null,
      createdAt: member.createdAt,
    }))
  },

  async getCreateOptions() {
    const auth = await getRenderAuth()
    const options = await apiRequest("/api/v1/staff/create-options/", { auth, schema: backendCreateOptionsSchema })
    // Где РОП уже есть, второго назначить нельзя (правило backend): форма подсказывает заранее
    const heads = options.creatableRoles.includes("head_of_sales")
      ? (await apiRequest("/api/v1/staff/", { auth, schema: paginatedSchema(backendStaffSchema) })).results.filter(
          (member) => member.role === "head_of_sales" && member.status !== "deactivated" && member.department
        )
      : []
    // Порядок важности: сначала роль, ради которой чаще всего создают аккаунт
    const order = ["head_of_sales", "manager", "lead_caller", "operations", "viewer", "director"] as const
    const roles = [...new Set(options.creatableRoles.map(uiRoleFromBackend))].toSorted(
      (a, b) => order.indexOf(a as (typeof order)[number]) - order.indexOf(b as (typeof order)[number])
    )
    const fixed = options.departments.find((department) => department.id === options.fixedDepartmentId) ?? null
    return createOptionsSchema.parse({
      creatableRole: roles[0] ?? null,
      roles,
      mode: options.canCreateDirectly ? "direct" : options.mode,
      departments: options.fixedDepartmentId ? [] : options.departments.map((department) => ({ id: department.id, name: department.name })),
      fixedDepartment: ref(fixed),
      loginIsOptional: true,
      departmentsWithHead: [...new Set(heads.map((member) => member.department?.id ?? ""))].filter(Boolean),
    })
  },

  async createAccount(input) {
    const role = input.role ? backendRoleFromUi(input.role) : null
    if (!role) throw new ApiError("validation", "Выберите роль", { fieldErrors: { role: ["Выберите роль"] } })
    const [firstName, ...rest] = input.fullName.trim().split(/\s+/)
    const created = await apiRequest("/api/v1/staff/", {
      method: "POST",
      auth: await getActionAuth(),
      body: { firstName, lastName: rest.join(" "), role, login: input.login ?? "", departmentId: input.departmentId },
      schema: z.object({ member: backendStaffSchema, temporaryPassword: z.string() }),
    })
    const user = await getCurrentUser()
    const member = created.member
    return createdAccountSchema.parse({
      member: {
        id: member.id,
        login: member.login,
        fullName: member.fullName || member.login,
        role: uiRoleFromBackend(member.role),
        company: { id: "", name: user.companyName },
        department: ref(member.department),
        status: member.status,
        createdBy: { id: user.id, name: user.fullName },
        createdAt: member.createdAt,
      },
      temporaryPassword: created.temporaryPassword,
    })
  },

  async listRequests() {
    const page = await apiRequest("/api/v1/staff/requests/", { auth: await getRenderAuth(), schema: paginatedSchema(backendRequestSchema) })
    return page.results.map(toRequest)
  },

  async requestHire(input) {
    const role = input.role ? backendRoleFromUi(input.role) : null
    if (!role) throw new ApiError("validation", "Выберите роль", { fieldErrors: { role: ["Выберите роль"] } })
    const [firstName, ...rest] = input.fullName.trim().split(/\s+/)
    const created = await apiRequest("/api/v1/staff/requests/", {
      method: "POST",
      auth: await getActionAuth(),
      body: { kind: "hire", firstName, lastName: rest.join(" "), role, login: input.login ?? "" },
      schema: backendRequestSchema,
    })
    return toRequest(created)
  },

  async approveRequest(requestId) {
    const approved = await apiRequest(`/api/v1/staff/requests/${encodeURIComponent(requestId)}/approve/`, {
      method: "POST",
      auth: await getActionAuth(),
      schema: z.object({ request: backendRequestSchema, temporaryPassword: z.string().optional() }),
    })
    // Логин созданного аккаунта — в списке сотрудников; в ответе заявки он есть, если его задал РОП
    let login = approved.request.candidate?.login ?? null
    if (approved.temporaryPassword && !login) {
      const staff = await apiRequest("/api/v1/staff/", { auth: await getActionAuth(), schema: paginatedSchema(backendStaffSchema) })
      login = staff.results.find((member) => member.id === approved.request.resultMembershipId)?.login ?? null
    }
    return approvedRequestSchema.parse({ request: toRequest(approved.request), login, temporaryPassword: approved.temporaryPassword ?? null })
  },

  async rejectRequest(requestId, note) {
    const rejected = await apiRequest(`/api/v1/staff/requests/${encodeURIComponent(requestId)}/reject/`, {
      method: "POST",
      auth: await getActionAuth(),
      body: { note },
      schema: backendRequestSchema,
    })
    return toRequest(rejected)
  },

  async cancelRequest(requestId) {
    const cancelled = await apiRequest(`/api/v1/staff/requests/${encodeURIComponent(requestId)}/cancel/`, {
      method: "POST",
      auth: await getActionAuth(),
      schema: backendRequestSchema,
    })
    return toRequest(cancelled)
  },

  async createDepartment(name) {
    const created = await apiRequest("/api/v1/departments/", {
      method: "POST",
      auth: await getActionAuth(),
      body: { name },
      schema: backendDepartmentSchema,
    })
    return { id: created.id, name: created.name }
  },

  async deactivate(membershipId) {
    await apiRequest(`/api/v1/staff/${encodeURIComponent(membershipId)}/deactivate/`, {
      method: "POST",
      auth: await getActionAuth(),
      schema: z.unknown(),
    })
  },

  async resetPassword(membershipId) {
    const result = await apiRequest(`/api/v1/staff/${encodeURIComponent(membershipId)}/reset-password/`, {
      method: "POST",
      auth: await getActionAuth(),
      schema: z.object({ temporaryPassword: z.string() }),
    })
    return result.temporaryPassword
  },
}

export const staffRepository: StaffRepository = isMockDataSource ? mockStaffRepository : httpStaffRepository
