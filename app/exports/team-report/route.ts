import { NextResponse, type NextRequest } from "next/server"

import { apiDownload } from "@/lib/api/client"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

const ALLOWED = ["period", "date", "department_id"] as const

/** CSV отчёта отдела через BFF: права и состав (без данных клиентов) решает backend */
export async function GET(request: NextRequest) {
  const query = new URLSearchParams({ export: "csv" })
  for (const key of ALLOWED) {
    const value = request.nextUrl.searchParams.get(key)
    if (value) query.set(key, value)
  }
  try {
    const file = await apiDownload(`/api/v1/team/reports/?${query.toString()}`, { auth: await getActionAuth() })
    return new NextResponse(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${(file.filename ?? "team-report.csv").replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    return new NextResponse(apiErrorMessage(error), { status: error.status ?? 502, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }
}
