import { NextResponse } from "next/server"

import { fetchFormerBase, fetchMemberDetail, leadsToCsv } from "@/features/staff/api/staff-profile"
import { ApiError, apiErrorMessage } from "@/lib/api/errors"
import { getActionAuth } from "@/lib/auth/token-store"
import { hasPermission } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

/**
 * База лидов сотрудника в CSV — для директора и РОПа. Права и область (РОП — свой отдел)
 * backend проверяет на каждом запросе; файл собирается на сервере интерфейса из его ответов.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = await params
  const user = await getCurrentUser()
  if (!hasPermission(user.role, "staff.manage")) {
    return new NextResponse("Скачивать базу сотрудника может директор или РОП.", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }
  try {
    const auth = await getActionAuth()
    const member = await fetchMemberDetail(auth, membershipId)
    const { leads } = await fetchFormerBase(auth, member.userId)
    const filename = `leads-${member.login.replace(/[^\w.-]/g, "_")}.csv`
    return new NextResponse(leadsToCsv(leads), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    return new NextResponse(apiErrorMessage(error), { status: error.status ?? 502, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }
}
