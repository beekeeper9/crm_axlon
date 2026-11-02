import { NextResponse } from "next/server"

import { apiDownload } from "@/lib/api/client"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

/**
 * Скачивание готовой выгрузки через BFF: браузер не видит токен, backend проверяет права
 * и область данных (выгрузки без телефонов клиентов — правило backend).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  try {
    const file = await apiDownload(`/api/v1/analytics/reports/${encodeURIComponent(jobId)}/download/`, { auth: await getActionAuth() })
    return new NextResponse(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${(file.filename ?? `report-${jobId}.csv`).replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    return new NextResponse(apiErrorMessage(error), { status: error.status ?? 502, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }
}
