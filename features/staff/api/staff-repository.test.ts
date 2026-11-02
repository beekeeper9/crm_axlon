import { describe, expect, it, vi } from "vitest"

const apiRequest = vi.fn()
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }))
vi.mock("@/lib/auth/token-store", () => ({ getRenderAuth: async () => ({}), getActionAuth: async () => ({}) }))
vi.mock("@/lib/session/current-user", () => ({ getCurrentUser: async () => ({ id: "u-rop", role: "head_of_sales" }) }))
vi.mock("@/features/team", () => ({ loadMemberNames: async () => new Map() }))

const { staffRepository } = await import("@/features/staff/api/staff-repository")

describe("найм РОПом", () => {
  it("can_create_directly от backend — прямое создание аккаунта, а не заявка директору", async () => {
    apiRequest.mockResolvedValueOnce({
      creatableRoles: ["sales_rep"],
      mode: "request",
      canCreateDirectly: true,
      departments: [{ id: "dep-1", name: "Отдел 1", isActive: true }],
      fixedDepartmentId: "dep-1",
    })
    const options = await staffRepository.getCreateOptions()
    expect(options.mode).toBe("direct")
    expect(options.fixedDepartment).toEqual({ id: "dep-1", name: "Отдел 1" })
  })
})
