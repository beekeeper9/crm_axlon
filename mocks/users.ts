/**
 * ДЕМО-ДАННЫЕ. Вымышленные люди и компания, не связаны с реальными клиентами.
 * Используются только в режиме NEXT_PUBLIC_DATA_SOURCE=mock.
 */
import type { Role } from "@/lib/permissions/roles"
import type { CurrentUser } from "@/lib/session/current-user"

const company = {
  companyName: "Демо Компания",
  departmentName: "Отдел продаж",
}

export const demoUsers: Record<Role, CurrentUser> = {
  platform_admin: { id: "u-admin", fullName: "Админ Платформы", role: "platform_admin", ...company },
  director: { id: "u-director", fullName: "Эрмек Жумабаев", role: "director", ...company },
  head_of_sales: { id: "u-rop", fullName: "Алина Ким", role: "head_of_sales", ...company },
  manager: { id: "m-1", fullName: "Айбек Садыков", role: "manager", ...company },
  viewer: { id: "u-viewer", fullName: "Света Пак", role: "viewer", ...company },
}
