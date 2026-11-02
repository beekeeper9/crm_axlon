"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isMockDataSource } from "@/config/env"
import { routes } from "@/config/routes"
import { fetchReportJob, requestKpiReport, type ReportJob } from "@/features/team-cabinet/api/reports"
import { ABSENCE_KINDS, PLAN_METRICS } from "@/features/team-cabinet/lib/plan-absence-meta"
import { apiRequest } from "@/lib/api/client"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

/** null — сохранено; иначе сообщение для пользователя */
export type CabinetActionResult = string | null

async function save(operation: () => Promise<unknown>): Promise<CabinetActionResult> {
  if (isMockDataSource) return "В демо-режиме изменения на сервер не отправляются."
  try {
    await operation()
    revalidatePath(routes.team)
    return null
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.kind === "forbidden" && !error.code?.includes("plan")) return "У вашей роли нет права на это действие."
    if (error.kind === "validation") return `Сервер не принял данные: ${error.message}`
    return apiErrorMessage(error)
  }
}

const planSchema = z.object({
  scope: z.enum(["company", "department", "user"]),
  scopeId: z.string().nullable(),
  metric: z.enum(PLAN_METRICS),
  period: z.string().regex(/^\d{4}-(\d{2}|W\d{2})(-\d{2})?$/, "Период — месяц ГГГГ-ММ"),
  target: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, "").replace(",", "."))
    .refine((value) => /^\d{1,13}(\.\d{1,2})?$/.test(value), "Цель — число"),
})

/** `PUT /plans/` — создать или изменить цель; каждое изменение backend пишет в историю */
export async function setPlanAction(input: z.input<typeof planSchema>): Promise<CabinetActionResult> {
  const parsed = planSchema.safeParse(input)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Проверьте поля"
  const { scopeId, ...plan } = parsed.data
  return save(async () =>
    apiRequest("/api/v1/plans/", { method: "PUT", auth: await getActionAuth(), body: { ...plan, ...(scopeId ? { scopeId } : {}) }, schema: z.unknown() })
  )
}

const absenceSchema = z
  .object({
    userId: z.string().min(1, "Выберите сотрудника"),
    kind: z.enum(ABSENCE_KINDS),
    startDate: z.iso.date("Укажите дату начала"),
    endDate: z.iso.date("Укажите дату окончания"),
    comment: z.string().trim().max(500, "Не длиннее 500 символов"),
  })
  .refine((value) => value.endDate >= value.startDate, { message: "Окончание не раньше начала", path: ["endDate"] })

/** `POST /absences/` — запланированное отсутствие не даёт сигнала «нет активности» */
export async function createAbsenceAction(input: z.input<typeof absenceSchema>): Promise<CabinetActionResult> {
  const parsed = absenceSchema.safeParse(input)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Проверьте поля"
  const { comment, ...absence } = parsed.data
  return save(async () =>
    apiRequest("/api/v1/absences/", { method: "POST", auth: await getActionAuth(), body: { ...absence, ...(comment ? { comment } : {}) }, schema: z.unknown() })
  )
}

export type ReportState = { ok: true; job: ReportJob } | { ok: false; message: string }

async function reportCall(operation: () => Promise<ReportJob>): Promise<ReportState> {
  if (isMockDataSource) return { ok: false, message: "В демо-режиме выгрузки не формируются." }
  try {
    return { ok: true, job: await operation() }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    return { ok: false, message: apiErrorMessage(error) }
  }
}

/** Заказать выгрузку KPI за период; файл формирует backend асинхронно */
export async function requestKpiReportAction(periodStart: string, periodEnd: string, key: string): Promise<ReportState> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodEnd < periodStart) {
    return { ok: false, message: "Укажите период: начало не позже окончания." }
  }
  return reportCall(async () => requestKpiReport(await getActionAuth(), periodStart, periodEnd, key))
}

export async function reportStatusAction(jobId: string): Promise<ReportState> {
  return reportCall(async () => fetchReportJob(await getActionAuth(), jobId))
}
