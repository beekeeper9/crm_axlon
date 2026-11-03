import { beforeEach, describe, expect, it, vi } from "vitest"

const createAccount = vi.fn()
const getCreateOptions = vi.fn()
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/token-store", () => ({ getActionAuth: async () => ({}), getRenderAuth: async () => ({}) }))
vi.mock("@/lib/session/current-user", () => ({ getCurrentUser: async () => ({ id: "u-dir", role: "director" }) }))
vi.mock("@/features/staff/api/staff-repository", () => ({
  staffRepository: { getCreateOptions: () => getCreateOptions(), createAccount: (input: unknown) => createAccount(input) },
}))

const { createStaffAccount } = await import("@/features/staff/actions")

const form = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

describe("создание сотрудника", () => {
  beforeEach(() => {
    createAccount.mockReset()
    getCreateOptions.mockReset()
  })

  it("директор без выбранного отдела — понятная ошибка, запрос на сервер не уходит", async () => {
    getCreateOptions.mockResolvedValue({ mode: "direct", fixedDepartment: null })
    const state = await createStaffAccount({ status: "idle" }, form({ fullName: "Тест Тестов", login: "", departmentId: "", role: "manager" }))
    expect(state.status).toBe("error")
    expect(state.status === "error" && state.fieldErrors.departmentId).toBe("Выберите отдел, к которому будет прикреплён сотрудник")
    expect(createAccount).not.toHaveBeenCalled()
  })

  it("после создания — экран с данными: имя, логин, пароль, роль и отдел", async () => {
    getCreateOptions.mockResolvedValue({ mode: "direct", fixedDepartment: null })
    createAccount.mockResolvedValue({
      member: { id: "m1", userId: "u1", login: "t.testov", fullName: "Тест Тестов", role: "manager", department: { id: "d1", name: "Отдел продаж" } },
      temporaryPassword: "secret-once",
    })
    const state = await createStaffAccount({ status: "idle" }, form({ fullName: "Тест Тестов", login: "", departmentId: "d1", role: "manager" }))
    expect(state).toMatchObject({
      status: "created",
      account: { fullName: "Тест Тестов", login: "t.testov", temporaryPassword: "secret-once", roleLabel: "Менеджер", department: "Отдел продаж" },
    })
  })
})
