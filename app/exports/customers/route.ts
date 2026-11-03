import { exportCustomers } from "@/features/imports/api/list-export"
import { csvExportResponse } from "@/features/imports/lib/export-response"

/**
 * База клиентов в CSV с фильтрами списка. Область (менеджер — свои клиенты, РОП — отдел)
 * backend проверяет на каждой странице; файл собирается на сервере интерфейса из его ответов.
 */
export async function GET(request: Request) {
  return csvExportResponse("clients", (auth) => exportCustomers(auth, new URL(request.url).searchParams))
}
