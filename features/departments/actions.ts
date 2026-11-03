"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { PLAN_METRICS, parseTarget } from "@/features/departments/lib/plan-distribution"
import { apiRequest } from "@/lib/api/client"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

/** null — сохранено; иначе сообщение для пользователя */
export type PlanActionResult = string | null

const BACKEND_MESSAGES: Array<[RegExp, string]> = [
  [/Set the company plan for this period first/i, "Сначала задайте план компании на этот месяц."],
  [/parts add up to/i, "Сумма частей должна быть равна плану компании."],
  [/Department not found/i, "Отдел не найден — возможно, его удалили. Обновите страницу."],
  [/Currency must be/i, "Валюта — трёхбуквенный код, например KGS или USD."],
  [/Only a director/i, "Планы компании и отделов задаёт директор."],
]

async function save(operation: () => Promise<unknown>): Promise<PlanActionResult> {
  if (isMockDataSource) return "В демо-режиме планы на сервер не сохраняются."
  // Удобство интерфейса: окончательно права проверяет backend
  if (!hasPermission((await getCurrentUser()).role, "company.view")) return "Планы компании и отделов задаёт директор."
  try {
    await operation()
    revalidatePath(routes.company)
    revalidatePath(routes.sales)
    revalidatePath(routes.departments, "layout")
    revalidatePath(routes.team)
    return null
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    const known = BACKEND_MESSAGES.find(([pattern]) => pattern.test(error.message))
    return known?.[1] ?? apiErrorMessage(error)
  }
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

const planSchema = z.object({
  scope: z.enum(["company", "department"]),
  scopeId: z.string().nullable(),
  period: z.string().regex(MONTH, "Месяц — в формате ГГГГ-ММ"),
  /** Пустая строка — эту цель не менять */
  salesTarget: z.string(),
  moneyTarget: z.string(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Выберите валюту"),
})

/**
 * План компании или отдела на месяц: количество продаж и/или денежный план с валютой.
 * Каждое изменение backend записывает в историю плана.
 */
export async function setPlansAction(input: z.input<typeof planSchema>): Promise<PlanActionResult> {
  const parsed = planSchema.safeParse(input)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Проверьте поля"
  const { scope, scopeId, period, currency } = parsed.data
  if (scope === "department" && !scopeId) return "Не выбран отдел."
  const sales = parsed.data.salesTarget.trim() === "" ? undefined : parseTarget(parsed.data.salesTarget)
  const money = parsed.data.moneyTarget.trim() === "" ? undefined : parseTarget(parsed.data.moneyTarget)
  if (sales === null) return "План продаж — целое или дробное число, например 20."
  if (money === null) return "Денежный план — число, например 1500000."
  if (sales === undefined && money === undefined) return "Укажите план продаж или денежный план."
  return save(async () => {
    const auth = await getActionAuth()
    const base = { scope, ...(scopeId ? { scopeId } : {}), period }
    if (sales !== undefined) {
      await apiRequest("/api/v1/plans/", { method: "PUT", auth, body: { ...base, metric: "monthly_sales", target: sales }, schema: z.unknown() })
    }
    if (money !== undefined) {
      await apiRequest("/api/v1/plans/", {
        method: "PUT",
        auth,
        body: { ...base, metric: "monthly_turnover", target: money, currency },
        schema: z.unknown(),
      })
    }
  })
}

const distributionSchema = z.object({
  period: z.string().regex(MONTH, "Месяц — в формате ГГГГ-ММ"),
  metric: z.enum(PLAN_METRICS),
  parts: z.array(z.object({ departmentId: z.string().min(1), target: z.string() })).min(1, "Нет отделов для распределения"),
})

/**
 * Распределение плана компании по отделам одной операцией (`POST /plans/distribute/`):
 * backend проверяет, что части в сумме равны плану компании, и меняет планы отделов
 * только этим явным действием директора.
 */
export async function distributePlanAction(input: z.input<typeof distributionSchema>): Promise<PlanActionResult> {
  const parsed = distributionSchema.safeParse(input)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Проверьте поля"
  const parts = parsed.data.parts.map((part) => ({ departmentId: part.departmentId, target: parseTarget(part.target === "" ? "0" : part.target) }))
  if (parts.some((part) => part.target === null)) return "Доли отделов — числа, например 5 или 250000."
  return save(async () =>
    apiRequest("/api/v1/plans/distribute/", {
      method: "POST",
      auth: await getActionAuth(),
      body: { metric: parsed.data.metric, period: parsed.data.period, parts },
      schema: z.unknown(),
    })
  )
}
