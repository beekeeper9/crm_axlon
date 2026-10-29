"use server"

import { staffRepository } from "@/features/staff/api/staff-repository"
import { createStaffFormSchema } from "@/features/staff/schemas"
import { API_ERROR_MESSAGES, ApiError } from "@/lib/api/errors"
import { hasPermission, ROLE_LABELS } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

type FieldName = "fullName" | "login" | "departmentId" | "companyName"

export type CreateStaffState =
  | { status: "idle" }
  | { status: "error"; message: string | null; fieldErrors: Partial<Record<FieldName, string>>; requestId: string | null; values: Record<FieldName, string> }
  | {
      status: "created"
      /** Временный пароль — только в этом ответе: не логируется и не сохраняется в браузере */
      account: { fullName: string; login: string; temporaryPassword: string; roleLabel: string; place: string }
    }

const FIELDS: readonly FieldName[] = ["fullName", "login", "departmentId", "companyName"]

/**
 * Создание аккаунта уровнем ниже. Роль из формы не принимается — её назначает сервер.
 * Право проверяется здесь и ещё раз на backend; интерфейс лишь не показывает форму тем, кому нельзя.
 */
export async function createStaffAccount(_previous: CreateStaffState, formData: FormData): Promise<CreateStaffState> {
  const user = await getCurrentUser()
  const values = Object.fromEntries(FIELDS.map((field) => [field, String(formData.get(field) ?? "")])) as Record<FieldName, string>
  if (!hasPermission(user.role, "staff.manage") && !hasPermission(user.role, "platform.manage")) {
    return { status: "error", message: "У вашей роли нет права создавать аккаунты.", fieldErrors: {}, requestId: null, values }
  }

  const parsed = createStaffFormSchema.safeParse(values)
  if (!parsed.success) {
    const fieldErrors: Partial<Record<FieldName, string>> = {}
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as FieldName] ??= issue.message
    return { status: "error", message: null, fieldErrors, requestId: null, values }
  }

  try {
    const { member, temporaryPassword } = await staffRepository.createAccount({
      fullName: parsed.data.fullName,
      login: parsed.data.login || null,
      departmentId: parsed.data.departmentId || null,
      companyName: parsed.data.companyName || null,
    })
    return {
      status: "created",
      account: {
        fullName: member.fullName,
        login: member.login,
        temporaryPassword,
        roleLabel: ROLE_LABELS[member.role],
        place: [member.company?.name, member.department?.name].filter(Boolean).join(" · "),
      },
    }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    const fieldErrors: Partial<Record<FieldName, string>> = {}
    for (const field of FIELDS) {
      const message = error.fieldErrors?.[field]?.[0]
      if (message) fieldErrors[field] = message
    }
    const message =
      error.kind === "contract_pending"
        ? "Создание аккаунтов ещё не подключено к серверу. Аккаунт не создан."
        : Object.keys(fieldErrors).length > 0
          ? null
          : error.kind === "validation"
            ? error.message
            : API_ERROR_MESSAGES[error.kind]
    return { status: "error", message, fieldErrors, requestId: error.requestId ?? null, values }
  }
}
