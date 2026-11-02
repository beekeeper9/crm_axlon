import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"

export const reportJobSchema = z.object({
  id: z.string(),
  reportType: z.string(),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  error: z.string().nullable(),
})

export type ReportJob = z.infer<typeof reportJobSchema>

/** `POST /analytics/reports/` — асинхронная выгрузка KPI (CSV); повтор с тем же ключом даёт ту же задачу */
export function requestKpiReport(auth: ApiAuth, periodStart: string, periodEnd: string, idempotencyKey: string): Promise<ReportJob> {
  return apiRequest("/api/v1/analytics/reports/", {
    method: "POST",
    auth,
    body: { reportType: "kpi_summary", periodStart, periodEnd, fmt: "csv", idempotencyKey },
    schema: reportJobSchema,
  })
}

export function fetchReportJob(auth: ApiAuth, jobId: string): Promise<ReportJob> {
  return apiRequest(`/api/v1/analytics/reports/${encodeURIComponent(jobId)}/`, { auth, schema: reportJobSchema })
}
