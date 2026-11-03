import { NextResponse } from "next/server"

import { apiDownload } from "@/lib/api/client"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"

/**
 * Чек оплаты через BFF: браузер не видит токен, кто может смотреть чек — решает backend
 * (тот, кто видит оплату или её сделку). Картинки и PDF открываются во вкладке, `?download=1` — скачать.
 */
export async function GET(request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params
  const download = new URL(request.url).searchParams.get("download") === "1"
  try {
    const file = await apiDownload(`/api/v1/payments/${encodeURIComponent(paymentId)}/receipt/`, { auth: await getActionAuth() })
    const filename = (file.filename ?? "receipt").replace(/["\\]/g, "")
    return new NextResponse(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        // Файл загрузил пользователь: никакие скрипты внутри него не выполняются
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    })
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    return new NextResponse(apiErrorMessage(error), { status: error.status ?? 502, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }
}
