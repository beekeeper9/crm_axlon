import { isMockDataSource } from "@/config/env"
import {
  createdAccountSchema,
  createOptionsSchema,
  staffMemberSchema,
  type CreatedAccount,
  type CreateOptions,
  type CreateStaffInput,
  type StaffMember,
} from "@/features/staff/schemas"
import { ApiError, contractPending } from "@/lib/api/errors"
import { CREATABLE_ROLE } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"
import { demoAccount, demoAccounts, demoCompany, demoCreateAccount, demoDepartment, demoDepartmentsOf, demoVisibleAccounts, type DemoAccount } from "@/mocks/demo-accounts"
import { simulateLatency } from "@/mocks/latency"

/** Создатель и область видимости — из сессии (backend — из токена), а не из параметров запроса */
export type StaffRepository = {
  listStaff(): Promise<StaffMember[]>
  getCreateOptions(): Promise<CreateOptions>
  createAccount(input: CreateStaffInput): Promise<CreatedAccount>
}

function toMember(account: DemoAccount): StaffMember {
  const company = demoCompany(account.companyId)
  const department = demoDepartment(account.departmentId)
  const creator = account.createdById ? demoAccount(account.createdById) : null
  return {
    id: account.id,
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
    return createOptionsSchema.parse({
      creatableRole: CREATABLE_ROLE[user.role] ?? null,
      requiresCompanyName: user.role === "platform_admin",
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
}

/** Endpoint не согласованы — см. docs/API_CONTRACT.md, раздел «Сотрудники и аккаунты». */
const httpStaffRepository: StaffRepository = {
  async listStaff() {
    return contractPending("список сотрудников")
  },
  async getCreateOptions() {
    return contractPending("создание аккаунтов")
  },
  async createAccount() {
    return contractPending("создание аккаунта")
  },
}

export const staffRepository: StaffRepository = isMockDataSource ? mockStaffRepository : httpStaffRepository
