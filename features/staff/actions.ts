"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { routes } from "@/config/routes"
import { staffRepository } from "@/features/staff/api/staff-repository"
import { STAFF_BACKEND_MESSAGES, staffErrorMessage } from "@/features/staff/lib/staff-messages"
import { createStaffFormSchema, type ApprovedRequest } from "@/features/staff/schemas"
import { ApiError } from "@/lib/api/errors"
import { hasPermission, ROLE_LABELS, type Role } from "@/lib/permissions/roles"
import { getCurrentUser } from "@/lib/session/current-user"

type FieldName = "fullName" | "login" | "departmentId" | "role"

export type CreateStaffState =
  | { status: "idle" }
  | { status: "error"; message: string | null; fieldErrors: Partial<Record<FieldName, string>>; requestId: string | null; values: Record<FieldName, string> }
  | {
      status: "created"
      /** Временный пароль — только в этом ответе: не логируется и не сохраняется в браузере */
      account: { fullName: string; login: string; temporaryPassword: string; roleLabel: string; place: string }
    }
  /** РОП: аккаунт появится после одобрения директором */
  | { status: "requested"; request: { fullName: string; roleLabel: string; department: string } }

const FIELDS: readonly FieldName[] = ["fullName", "login", "departmentId", "role"]

/**
 * Создание аккаунта: директор — в компании, РОП — менеджера своего отдела (напрямую, без заявки;
 * отдел backend подставляет сам). Если сервер для роли разрешает только заявку — отправляется заявка.
 * Право проверяется здесь и ещё раз на backend; интерфейс лишь не показывает форму тем, кому нельзя.
 */
export async function createStaffAccount(_previous: CreateStaffState, formData: FormData): Promise<CreateStaffState> {
  const user = await getCurrentUser()
  const values = Object.fromEntries(FIELDS.map((field) => [field, String(formData.get(field) ?? "")])) as Record<FieldName, string>
  if (!hasPermission(user.role, "staff.hire")) {
    return { status: "error", message: "У вашей роли нет права создавать аккаунты.", fieldErrors: {}, requestId: null, values }
  }

  const parsed = createStaffFormSchema.safeParse(values)
  if (!parsed.success) {
    const fieldErrors: Partial<Record<FieldName, string>> = {}
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as FieldName] ??= issue.message
    return { status: "error", message: null, fieldErrors, requestId: null, values }
  }
  const input = {
    fullName: parsed.data.fullName,
    login: parsed.data.login || null,
    departmentId: parsed.data.departmentId || null,
    role: (parsed.data.role || null) as Role | null,
  }

  try {
    const asRequest = (await staffRepository.getCreateOptions()).mode === "request"
    if (asRequest) {
      const request = await staffRepository.requestHire(input)
      revalidatePath(routes.staff)
      return {
        status: "requested",
        request: {
          fullName: request.candidate?.fullName ?? input.fullName,
          roleLabel: request.candidate ? ROLE_LABELS[request.candidate.role] : "",
          department: request.department.name,
        },
      }
    }
    const { member, temporaryPassword } = await staffRepository.createAccount(input)
    revalidatePath(routes.staff)
    revalidatePath(routes.company)
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
      if (message) fieldErrors[field] = STAFF_BACKEND_MESSAGES[message] ?? message
    }
    if (error.message === "This login is already taken.") fieldErrors.login = STAFF_BACKEND_MESSAGES[error.message]
    const message = Object.keys(fieldErrors).length > 0 ? null : staffErrorMessage(error)
    return { status: "error", message, fieldErrors, requestId: error.requestId ?? null, values }
  }
}

export type RequestActionResult<T = null> = { ok: true; data: T } | { ok: false; message: string; requestId: string | null }

async function run<T>(operation: () => Promise<T>): Promise<RequestActionResult<T>> {
  try {
    const data = await operation()
    revalidatePath(routes.staff)
    revalidatePath(routes.company)
    return { ok: true, data }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    return { ok: false, message: staffErrorMessage(error), requestId: error.requestId ?? null }
  }
}

/** Директор одобряет заявку; при найме пароль нового аккаунта приходит один раз */
export async function approveStaffRequest(requestId: string): Promise<RequestActionResult<ApprovedRequest>> {
  if (!hasPermission((await getCurrentUser()).role, "staff.hire")) return { ok: false, message: "Одобрять заявки может только директор.", requestId: null }
  return run(() => staffRepository.approveRequest(requestId))
}

export async function rejectStaffRequest(requestId: string, note: string): Promise<RequestActionResult> {
  if (!hasPermission((await getCurrentUser()).role, "staff.hire")) return { ok: false, message: "Отклонять заявки может только директор.", requestId: null }
  return run(async () => {
    await staffRepository.rejectRequest(requestId, note.trim().slice(0, 500))
    return null
  })
}

export async function cancelStaffRequest(requestId: string): Promise<RequestActionResult> {
  return run(async () => {
    await staffRepository.cancelRequest(requestId)
    return null
  })
}

const departmentNameSchema = z.string().trim().min(2, "Не короче 2 символов").max(100, "Не длиннее 100 символов")

/** Новый отдел продаж — право директора, backend проверяет его ещё раз */
export async function createDepartmentAction(name: string): Promise<RequestActionResult<{ id: string; name: string }>> {
  if (!hasPermission((await getCurrentUser()).role, "company.view")) return { ok: false, message: "Создавать отделы может только директор.", requestId: null }
  const parsed = departmentNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Укажите название", requestId: null }
  return run(() => staffRepository.createDepartment(parsed.data))
}

/** Отключить сотрудника. Backend решает, можно ли (директор — компания, РОП — менеджеры отдела) */
export async function deactivateStaffAction(membershipId: string): Promise<RequestActionResult> {
  if (!hasPermission((await getCurrentUser()).role, "staff.hire")) return { ok: false, message: "У вашей роли нет права отключать сотрудников.", requestId: null }
  return run(async () => {
    await staffRepository.deactivate(membershipId)
    return null
  })
}

/** Новый временный пароль сотруднику — показывается один раз и нигде не сохраняется */
export async function resetStaffPasswordAction(membershipId: string): Promise<RequestActionResult<string>> {
  if (!hasPermission((await getCurrentUser()).role, "staff.manage")) return { ok: false, message: "У вашей роли нет права сбрасывать пароли.", requestId: null }
  return run(() => staffRepository.resetPassword(membershipId))
}
