import { NextResponse } from "next/server"

import type { ExportFile } from "@/features/imports/api/list-export"
import type { ApiAuth } from "@/lib/api/auth-session"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

const TEXT = { "Content-Type": "text/plain; charset=utf-8" }

/** Ответ обработчика выгрузки: CSV-файл или понятная ошибка текстом */
export async function csvExportResponse(name: string, build: (auth: ApiAuth) => Promise<ExportFile>): Promise<NextResponse> {
  try {
    const file = await build(await getActionAuth())
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(file.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-${date}.csv"`,
        "Cache-Control": "no-store",
        // Сколько строк попало в файл из скольких найденных (выгрузка ограничена)
        "X-Export-Rows": `${file.exported}/${file.total}`,
      },
    })
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    return new NextResponse(apiErrorMessage(error), { status: error.status ?? 502, headers: TEXT })
  }
}
