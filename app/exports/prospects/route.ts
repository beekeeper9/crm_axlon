import { exportLeads } from "@/features/imports/api/list-export"
import { csvExportResponse } from "@/features/imports/lib/export-response"

/** Входящие лиды в CSV с фильтрами списка; область видимости — как у списка на backend */
export async function GET(request: Request) {
  return csvExportResponse("leads", (auth) => exportLeads(auth, new URL(request.url).searchParams))
}
