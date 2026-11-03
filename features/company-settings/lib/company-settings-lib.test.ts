import { describe, expect, it } from "vitest"

import { actionLabel, ownerChange } from "@/features/company-settings/lib/audit-labels"
import { withCurrent } from "@/features/company-settings/lib/settings-options"
import { setupSteps } from "@/features/company-settings/lib/setup-checklist"

describe("чек-лист запуска компании", () => {
  it("новая компания: ни один шаг не сделан", () => {
    expect(setupSteps({ departments: [], staff: [{ role: "director", status: "active", departmentId: null }], hasCompanyPlan: false }).map((s) => s.done)).toEqual([
      false,
      false,
      false,
      false,
    ])
  })

  it("РОП и менеджер считаются только в отделе и не отключённые", () => {
    const steps = setupSteps({
      departments: [{ id: "d-1" }],
      staff: [
        { role: "head_of_sales", status: "invited", departmentId: "d-1" },
        { role: "sales_rep", status: "deactivated", departmentId: "d-1" },
        { role: "sales_rep", status: "active", departmentId: null },
      ],
      hasCompanyPlan: true,
    })
    expect(Object.fromEntries(steps.map((s) => [s.key, s.done]))).toEqual({ department: true, head: true, managers: false, plan: true })
  })
})

describe("журнал изменений", () => {
  it("подписи действий по-русски, неизвестное — как есть", () => {
    expect(actionLabel("deal.stage_changed")).toBe("Сделка: смена этапа")
    expect(actionLabel("customer.reassigned")).toBe("Клиент: смена ответственного")
    expect(actionLabel("robot.exploded")).toBe("robot.exploded")
  })

  it("смена ответственного читается из details", () => {
    expect(ownerChange({ fromOwner: "u-1", toOwner: "u-2" })).toEqual({ from: "u-1", to: "u-2" })
    expect(ownerChange({})).toBeNull()
  })
})

describe("варианты настроек", () => {
  it("текущее значение вне списка не теряется", () => {
    expect(withCurrent([{ value: "KGS", label: "KGS" }], "CHF")[0]).toEqual({ value: "CHF", label: "CHF" })
    expect(withCurrent([{ value: "KGS", label: "KGS" }], "KGS")).toHaveLength(1)
  })
})
